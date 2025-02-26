import { Vector3 } from '@babylonjs/core/Maths/math';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MorphTarget } from '@babylonjs/core/Morph/morphTarget';
import { Nullable } from '@babylonjs/core/types';
import {ConstructSpringsOptions, SpringBoneController} from './secondary-animation/spring-bone-controller';
import {HumanoidBone, TransformNodeMap} from './humanoid-bone';
import { IVRM } from './vrm-interfaces';
import {
    Node,
    Scene,
    TargetCamera
} from "@babylonjs/core";

interface MorphTargetSetting {
    target: MorphTarget;
    weight: number;
}

interface MorphTargetMap {
    [morphName: string]: MorphTargetSetting[];
}

interface MorphTargetPropertyMap {
    [morphName: string]: morphingTargetProperty;
}

interface TransformNodeCache {
    [nodeIndex: number]: TransformNode;
}

export interface TransformNodeTreeNode {
    id: number;
    name: string;
    parent: number;
    children?: TransformNodeTreeNode[];
}

interface MeshCache {
    [meshIndex: number]: Mesh[];
}

/**
 * Unity Humanoid Bone 名
 */
export type HumanBoneName = 'hips' | 'leftUpperLeg' | 'rightUpperLeg' | 'leftLowerLeg' | 'rightLowerLeg' | 'leftFoot' | 'rightFoot' | 'spine' | 'chest' | 'neck' | 'head' | 'leftShoulder' | 'rightShoulder' | 'leftUpperArm' | 'rightUpperArm' | 'leftLowerArm' | 'rightLowerArm' | 'leftHand' | 'rightHand' | 'leftToes' | 'rightToes' | 'leftEye' | 'rightEye' | 'jaw' | 'leftThumbProximal' | 'leftThumbIntermediate' | 'leftThumbDistal' | 'leftIndexProximal' | 'leftIndexIntermediate' | 'leftIndexDistal' | 'leftMiddleProximal' | 'leftMiddleIntermediate' | 'leftMiddleDistal' | 'leftRingProximal' | 'leftRingIntermediate' | 'leftRingDistal' | 'leftLittleProximal' | 'leftLittleIntermediate' | 'leftLittleDistal' | 'rightThumbProximal' | 'rightThumbIntermediate' | 'rightThumbDistal' | 'rightIndexProximal' | 'rightIndexIntermediate' | 'rightIndexDistal' | 'rightMiddleProximal' | 'rightMiddleIntermediate' | 'rightMiddleDistal' | 'rightRingProximal' | 'rightRingIntermediate' | 'rightRingDistal' | 'rightLittleProximal' | 'rightLittleIntermediate' | 'rightLittleDistal' | 'upperChest' | string;

export class morphingTargetProperty {
    private _value: number;
    get value(): number {
        return this._value;
    }

    set value(value: number) {
        this._value = Math.max(0, Math.min(1, value));
        this.manager.morphing(this.label, value);
    }

    constructor(
        public label: string,
        value: number,
        private manager: VRMManager
    ) {
        this._value = value;
    }
}

/**
 * VRM キャラクターを動作させるためのマネージャ
 */
export class VRMManager {

    public static ROOT_MESH_PREFIX = "vrm_root_";

    private morphTargetMap: MorphTargetMap = {};
    private presetMorphTargetMap: MorphTargetMap = {};
    private transformNodeMap: TransformNodeMap = {};
    private _transformNodeTree: TransformNodeTreeNode;
    get transformNodeTree(): TransformNodeTreeNode {
        return this._transformNodeTree;
    }
    private transformNodeCache: TransformNodeCache = {};
    private meshCache: MeshCache = {};
    private _rootSkeleton: Node;
    private _humanoidBone: HumanoidBone;
    private _rootMesh!: Mesh;
    private _cameras: TargetCamera[] = [];
    get cameras(): TargetCamera[] {
        return this._cameras;
    }

    public appendCamera(camera: TargetCamera) {
        this._cameras.push(camera);
    }

    public resetCameras() {
        this._cameras = [];
    }

    /**
     * Secondary Animation として定義されている VRM Spring Bone のコントローラ
     */
    public readonly springBoneController: SpringBoneController;

    /**
     * This is necessary because of the way BabylonJS animation works
     */
    public MorphTargetPropertyMap: MorphTargetPropertyMap = {};

    /**
     *
     * @param ext glTF.extensions.VRM の中身 json
     * @param scene
     * @param meshesFrom この番号以降のメッシュがこの VRM に該当する
     * @param transformNodesFrom この番号以降の TransformNode がこの VRM に該当する
     * @param uri URI this manager belongs to
     */
    public constructor(
        public readonly ext: IVRM,
        public readonly scene: Scene,
        private readonly meshesFrom: number,
        private readonly transformNodesFrom: number,
        public readonly uri: string,
    ) {
        this.meshCache = this.constructMeshCache();
        this.transformNodeCache = this.constructTransformNodeCache();
        this.springBoneController = new SpringBoneController(
            this.ext.secondaryAnimation,
            this.findTransformNode.bind(this),
        );
        this.springBoneController.setup();

        this.constructMorphTargetMap();
        this.constructTransformNodeMap();

        this._humanoidBone = new HumanoidBone(this.transformNodeMap);

        this.removeDuplicateSkeletons();
        this._rootSkeleton = this.getRootSkeletonNode();

        // Rename __root__ node
        this.rootMesh.name = VRMManager.ROOT_MESH_PREFIX +
            this.scene.getNodes().filter(
                e => e.name.includes(VRMManager.ROOT_MESH_PREFIX)
            ).length;
    }

    /**
     * Remove duplicate skeletons when importing VRM.
     * Only tested on VRoidStudio output files.
     * @private
     */
    private removeDuplicateSkeletons() {
        let skeleton = null;
        for (const nodeIndex of Object.keys(this.meshCache).map(Number)) {
            const meshes = this.meshCache[nodeIndex];
            if (meshes.length && meshes[0].skeleton) {
                if (!skeleton) {
                    skeleton = meshes[0].skeleton;
                    if (this._rootMesh) {
                        const rootBone = skeleton.bones[0];
                        // Usually it is called "Root", but there are exceptions
                        if (rootBone.name !== "Root")
                            console.warn('The first bone has a different name than "Root"');
                    }
                } else {
                    // weak sanity check
                    if (skeleton.bones.length != meshes[0].skeleton.bones.length)
                        console.warn("Skeletons have different numbers of bones!");

                    meshes[0].skeleton.dispose();
                    for (const mesh of meshes) {
                        mesh.skeleton = skeleton;
                    }
                }
            }
        }
    }

    /**
     * Find the root node of skeleton.
     * @private
     */
    private getRootSkeletonNode(): Node {
        const rootMeshChildren = this._rootMesh.getChildren((node: Node) => {
            return node.name === "Root" || node.name === "Armature";
        })
        if (rootMeshChildren.length > 0)
            return rootMeshChildren[0];
        else {
            // Try to find in scene directly
            const rootMeshChild = this.scene.getNodeByName("Root")
                ? this.scene.getNodeByName("Root")
                : this.scene.getNodeByName("Armature");
            if (rootMeshChild && !rootMeshChild.parent)
                return rootMeshChild;
            else
                throw Error("Cannot find root skeleton node!");
        }
    }

    /**
     * Secondary Animation を更新する
     *
     * @param deltaTime 前フレームからの経過秒数(sec)
     * @param boneOptions
     */
    public async update(
        deltaTime: number,
        boneOptions?: ConstructSpringsOptions): Promise<void> {
        await this.springBoneController.update(deltaTime, boneOptions);
    }

    /**
     * 破棄処理
     */
    public dispose(): void {
        this.springBoneController.dispose();
        this._humanoidBone.dispose();
        this._rootSkeleton.dispose();
        if (this._rootMesh) this._rootMesh.dispose();

        (this.morphTargetMap as any) = null;
        (this.MorphTargetPropertyMap as any) = null;
        (this.presetMorphTargetMap as any) = null;
        (this.transformNodeMap as any) = null;
        (this.transformNodeCache as any) = null;
        (this.meshCache as any) = null;
        (this._cameras as any) = null;
        (this._transformNodeTree as any) = null;
        (this._rootMesh as any) = null;
    }

    /**
     * モーフィングを行う
     * @param label モーフ名
     * @param value 値(0〜1)
     */
    public morphing(label: string, value: number): void {
        if (!this.morphTargetMap[label]) {
            return;
        }
        this.morphTargetMap[label].forEach((setting) => {
            setting.target.influence = Math.max(0, Math.min(1, value)) * (setting.weight / 100);
        });
    }

    /**
     * プリセットモーフのモーフィングを行う
     * @param label モーフ名
     * @param value 値(0〜1)
     */
    public morphingPreset(label: string, value: number): void {
        if (!this.presetMorphTargetMap[label]) {
            return;
        }
        this.presetMorphTargetMap[label].forEach((setting) => {
            setting.target.influence = Math.max(0, Math.min(1, value)) * (setting.weight / 100);
        });
    }

    /**
     * list morphing name
     */
    public getMorphingList(): string[] {
        return Object.keys(this.morphTargetMap);
    }

    /**
     * 一人称時のカメラ位置を絶対座標として取得する
     *
     * firstPersonBone が未設定の場合は null を返す
     *
     * @returns 一人称時のカメラの現在における絶対座標
     */
    public getFirstPersonCameraPosition(): Nullable<Vector3> {
        const firstPersonBone = this.getFirstPersonBone();
        if (!firstPersonBone) {
            return null;
        }

        let basePos = firstPersonBone.getAbsolutePosition();
        const offsetPos = this.ext.firstPerson.firstPersonBoneOffset;
        return new Vector3(
            basePos.x + offsetPos.x,
            basePos.y + offsetPos.y,
            basePos.z + offsetPos.z,
        );
    }

    /**
     * 一人称時に頭とみなす TransformNode を取得する
     */
    public getFirstPersonBone(): Nullable<TransformNode> {
        return this.findTransformNode(this.ext.firstPerson.firstPersonBone);
    }

    /**
     * Get HumanoidBone Methods
     */
    public get humanoidBone(): HumanoidBone {
        return this._humanoidBone;
    }

    /**
     * VRM Root mesh
     *
     * Useful for Model Transformation
     */
    public get rootMesh(): Mesh {
        return this._rootMesh;
    }

    public get rootSkeletonNode(): Node {
        return this._rootSkeleton;
    }

    /**
     * node 番号から該当する TransformNode を探す
     * 数が多くなるのでキャッシュに参照を持つ構造にする
     * gltf の node 番号は `metadata.gltf.pointers` に記録されている
     * @param nodeIndex
     */
    public findTransformNode(nodeIndex: number): Nullable<TransformNode> {
        return this.transformNodeCache[nodeIndex] || null;
    }

    /**
     * Find index of s specific TransformNode from cache
     * @param node
     */
    public indexOfTransformNode(node: Nullable<Node>): number {
        for (const [k, v] of Object.entries(this.transformNodeCache)) {
            if (node == v) return parseInt(k, 10);
        }
        return -1;
    }

    /**
     * mesh 番号からメッシュを探す
     * gltf の mesh 番号は `metadata.gltf.pointers` に記録されている
     */
    public findMeshes(meshIndex: number): Nullable<Mesh[]> {
        return this.meshCache[meshIndex] || null;
    }

    /**
     * 事前に MorphTarget と BlendShape を紐付ける
     */
    private constructMorphTargetMap(): void {
        if (!this.ext.blendShapeMaster || !this.ext.blendShapeMaster.blendShapeGroups) {
            return;
        }
        this.ext.blendShapeMaster.blendShapeGroups.forEach((g) => {
            if (!g.binds) {
                return;
            }
            g.binds.forEach((b) => {
                const meshes = this.findMeshes(b.mesh);
                if (!meshes) {
                    console.log(`Undefined BlendShapeBind Mesh`, b);
                    return;
                }
                meshes.forEach((mesh) => {
                    const morphTargetManager = mesh.morphTargetManager;
                    if (!morphTargetManager) {
                        console.log(`Undefined morphTargetManager`, b);
                        return;
                    }
                    const target = morphTargetManager.getTarget(b.index);
                    this.morphTargetMap[g.name] = this.morphTargetMap[g.name] || [];
                    this.morphTargetMap[g.name].push({
                        target,
                        weight: b.weight,
                    });
                    this.MorphTargetPropertyMap[g.name] = new morphingTargetProperty(g.name, 0., this);
                    if (g.presetName) {
                        this.presetMorphTargetMap[g.presetName] = this.presetMorphTargetMap[g.presetName] || [];
                        this.presetMorphTargetMap[g.presetName].push({
                            target,
                            weight: b.weight,
                        });
                    }
                });
            });
            // TODO: materialValues
        });
    }

    /**
     * 事前に TransformNode と bone 名を紐づける
     */
    private constructTransformNodeMap() {
        const treePreArr: TransformNodeTreeNode[] = [];
        this.ext.humanoid.humanBones.forEach((b) => {
            const node = this.findTransformNode(b.node);
            if (!node) {
                return;
            }
            this.transformNodeMap[b.bone] = node;
            treePreArr.push({id: b.node, name: b.bone, parent: this.indexOfTransformNode(node.parent)});
        });
        const tree = this.hierarchy(treePreArr);
        if (tree.length === 0) throw Error("Failed to construct bone hierarchy tree!");
        this._transformNodeTree = tree[0];
    }

    private hierarchy(data: TransformNodeTreeNode[]) {
        const tree: TransformNodeTreeNode[] = [];
        const childOf: any = {};
        data.forEach((item) => {
            const id = item.id;
            const parent = item.parent;
            childOf[id] = childOf[id] || [];
            item.children = childOf[id];
            // Assume Hips is root
            if (parent != null && this.transformNodeCache[parent].parent != this._rootMesh
            && item.name.toLowerCase() !== 'hips') {
                (childOf[parent] = childOf[parent] || []).push(item)
            } else {
                tree.push(item);
            }
        });
        return tree;
    }

    /**
     * node 番号と TransformNode を紐づける
     */
    private constructTransformNodeCache() {
        const cache: TransformNodeCache = {};
        for (let index = this.transformNodesFrom; index < this.scene.transformNodes.length; index++) {
            const node = this.scene.transformNodes[index];
            // ポインタが登録されていないものは省略
            if (!node || !node.metadata || !node.metadata.gltf || !node.metadata.gltf.pointers || node.metadata.gltf.pointers.length === 0) {
                continue;
            }
            for (const pointer of node.metadata.gltf.pointers) {
                if (pointer.startsWith('/nodes/')) {
                    const nodeIndex = parseInt((pointer as string).substring(7), 10);
                    cache[nodeIndex] = node;
                    break;
                }
            }
        }
        return cache;
    }

    /**
     * mesh 番号と Mesh を紐づける
     */
    private constructMeshCache() {
        const cache: MeshCache = {};
        for (let index = this.meshesFrom; index < this.scene.meshes.length; index++) {
            const mesh = this.scene.meshes[index];
            if (mesh.id === '__root__') {
                this._rootMesh = mesh as Mesh;
                continue;
            }
            // ポインタが登録されていないものは省略
            if (!mesh || !mesh.metadata || !mesh.metadata.gltf || !mesh.metadata.gltf.pointers || mesh.metadata.gltf.pointers.length === 0) {
                continue;
            }
            for (const pointer of mesh.metadata.gltf.pointers) {
                const match = (pointer as string).match(/^\/meshes\/(\d+).+$/);
                if (match) {
                    const nodeIndex = parseInt(match[1], 10);
                    cache[nodeIndex] = cache[nodeIndex] || [];
                    cache[nodeIndex].push(mesh as Mesh);
                    break;
                }
            }
        }
        return cache;
    }

    /**
     * Set whether shadow are received.
     * @param enabled
     */
    public setShadowEnabled(enabled: boolean) {
        for (const nodeIndex of Object.keys(this.meshCache).map(Number)) {
            const meshes = this.meshCache[nodeIndex];
            for (const mesh of meshes) {
                mesh.receiveShadows = enabled;
            }
        }
    }
}
