import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MorphTarget } from '@babylonjs/core/Morph/morphTarget';
import { Nullable } from '@babylonjs/core/types';
import {SpringBoneController} from './secondary-animation/spring-bone-controller';
import { HumanoidBone } from './humanoid-bone';
import { IVRM } from './vrm-interfaces';
import {
    AbstractMesh,
    Node,
    PhysicsImpostor,
    PhysicsImpostorParameters,
    QuadraticErrorSimplification, Scene, Skeleton
} from "@babylonjs/core";
import { PhysicsViewer } from "@babylonjs/core/Debug";

interface MorphTargetSetting {
    target: MorphTarget;
    weight: number;
}

interface MorphTargetMap {
    [morphName: string]: MorphTargetSetting[];
}

interface TransformNodeMap {
    [humanBoneName: string]: TransformNode;
}

interface TransformNodeCache {
    [nodeIndex: number]: TransformNode;
}

interface MeshCache {
    [meshIndex: number]: Mesh[];
}

interface NodeMeshInfo {
    nodeIndex: number;
    nodeMeshes: Mesh[];
    nodeParent: Nullable<Node>;
    nodeSkeleton: Nullable<Skeleton>;
    nodeType: string;
}

interface MeshCacheInfo {
    Body?: NodeMeshInfo;
    Face?: NodeMeshInfo;
    Hair?: NodeMeshInfo;
}


/**
 * Unity Humanoid Bone 名
 */
export type HumanBoneName = 'hips' | 'leftUpperLeg' | 'rightUpperLeg' | 'leftLowerLeg' | 'rightLowerLeg' | 'leftFoot' | 'rightFoot' | 'spine' | 'chest' | 'neck' | 'head' | 'leftShoulder' | 'rightShoulder' | 'leftUpperArm' | 'rightUpperArm' | 'leftLowerArm' | 'rightLowerArm' | 'leftHand' | 'rightHand' | 'leftToes' | 'rightToes' | 'leftEye' | 'rightEye' | 'jaw' | 'leftThumbProximal' | 'leftThumbIntermediate' | 'leftThumbDistal' | 'leftIndexProximal' | 'leftIndexIntermediate' | 'leftIndexDistal' | 'leftMiddleProximal' | 'leftMiddleIntermediate' | 'leftMiddleDistal' | 'leftRingProximal' | 'leftRingIntermediate' | 'leftRingDistal' | 'leftLittleProximal' | 'leftLittleIntermediate' | 'leftLittleDistal' | 'rightThumbProximal' | 'rightThumbIntermediate' | 'rightThumbDistal' | 'rightIndexProximal' | 'rightIndexIntermediate' | 'rightIndexDistal' | 'rightMiddleProximal' | 'rightMiddleIntermediate' | 'rightMiddleDistal' | 'rightRingProximal' | 'rightRingIntermediate' | 'rightRingDistal' | 'rightLittleProximal' | 'rightLittleIntermediate' | 'rightLittleDistal' | 'upperChest' | string;


const options: PhysicsImpostorParameters = {
    mass: 0,
    friction: 0.1,
    restitution: 0.9,
}
const options_soft: PhysicsImpostorParameters = {
    mass: 0.1,
    friction: 0.2,
    restitution: 0.9,
    pressure: 0,
    velocityIterations: 2,
    positionIterations: 5,
    stiffness: 1,
    margin: 0.1,
    damping: 0.05,
}

/**
 * VRM キャラクターを動作させるためのマネージャ
 */
export class VRMManager {
    private morphTargetMap: MorphTargetMap = {};
    private presetMorphTargetMap: MorphTargetMap = {};
    private transformNodeMap: TransformNodeMap = {};
    private transformNodeCache: TransformNodeCache = {};
    private meshCache: MeshCache = {};
    private meshCacheInfo: MeshCacheInfo;
    private physicsViewer: PhysicsViewer;
    private physicsDebug: boolean;
    private _rootSkeleton: Node;
    private _humanoidBone: HumanoidBone;
    private _rootMesh!: Mesh;

    // Whether hair meshes finished loading
    private _hairReady: boolean = false;
    public get hairReady(): boolean {
        return this._hairReady;
    }

    /**
     * Secondary Animation として定義されている VRM Spring Bone のコントローラ
     */
    public readonly springBoneController: SpringBoneController;

    /**
     *
     * @param ext glTF.extensions.VRM の中身 json
     * @param scene
     * @param meshesFrom この番号以降のメッシュがこの VRM に該当する
     * @param transformNodesFrom この番号以降の TransformNode がこの VRM に該当する
     */
    public constructor(
        public readonly ext: IVRM,
        public readonly scene: Scene,
        private readonly meshesFrom: number,
        private readonly transformNodesFrom: number,
    ) {
        this.meshCache = this.constructMeshCache();
        this.transformNodeCache = this.constructTransformNodeCache();
        this.springBoneController = new SpringBoneController(
            this.ext.secondaryAnimation,
            this.findTransformNode.bind(this),
            {
                gravityPower: 0.5,
            }
        );
        this.springBoneController.setup();

        this.constructMorphTargetMap();
        this.constructTransformNodeMap();

        this._humanoidBone = new HumanoidBone(this.transformNodeMap);

        this.removeDuplicateSkeletons();
        this._rootSkeleton = this.getRootSkeletonNode();
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
     */
    public async update(deltaTime: number): Promise<void> {
        await this.springBoneController.update(deltaTime);
    }

    /**
     * 破棄処理
     */
    public dispose(): void {
        this.springBoneController.dispose();
        this._humanoidBone.dispose();

        (this.morphTargetMap as any) = null;
        (this.presetMorphTargetMap as any) = null;
        (this.transformNodeMap as any) = null;
        (this.transformNodeCache as any) = null;
        (this.meshCache as any) = null;
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
        this.ext.humanoid.humanBones.forEach((b) => {
            const node = this.findTransformNode(b.node);
            if (!node) {
                return;
            }
            this.transformNodeMap[b.bone] = node;
        });
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
                    const nodeIndex = parseInt((pointer as string).substr(7), 10);
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
     * Add physics imposters to mesh primitives if physics engine
     * is enabled in current scene.
     * Must be the last step because of mesh merge.
     */
    public enablePhysics(debug=false) {
        if (!this.scene.physicsEnabled) return;

        this.physicsViewer = new PhysicsViewer(this.scene);
        this.physicsDebug = debug;

        // Body
        this.addPhysicsImposters(this.meshCacheInfo.Body);

        // Hair
        this.addPhysicsImposters(this.meshCacheInfo.Hair);
    }

    private addPhysicsImposters(nodeMeshInfo: any) {
        console.log(nodeMeshInfo.nodeParent);
        const nodeIndex = nodeMeshInfo.nodeIndex;
        if (nodeMeshInfo.nodeMeshes.length && nodeMeshInfo.nodeParent) {
            switch (nodeMeshInfo.nodeType) {
                case "Body":
                    const imposterType = PhysicsImpostor.MeshImpostor;
                    for (let i = 0; i < this.meshCache[nodeIndex].length; i++) {
                        const thisMesh = this.meshCache[nodeIndex][i];
                        // thisMesh.skeleton = null;
                        let showImpostor = true;
                        if (i == 0)
                            showImpostor = true;

                        this.reCalculateBoundingBox(thisMesh);
                        this.createImposter(thisMesh, imposterType,
                            options, true, true, false, showImpostor);
                    }

                    // MeshImposter cannot be parented
                    // Using locked joints instead
                    const mainBodyImpostor = this.meshCache[nodeIndex][0].physicsImpostor;
                    for (let i = 0; i < this.meshCache[nodeIndex].length; i++) {
                        if (i > 0 && i < 4 && mainBodyImpostor) {
                            const mainImpostor = this.meshCache[nodeIndex][i].physicsImpostor;
                            mainImpostor?.addJoint(
                                mainBodyImpostor,
                                new PhysicsJoint(
                                    PhysicsJoint.LockJoint,
                                    {
                                        collision: false,
                                    }
                                )
                            );
                        }
                    }

                    // this.createImposter(nodeMeshInfo.nodeParent as Mesh, imposterType,
                    //     options, true, false, false, false)
                    break;
                case "Hair":
                    const mergedMesh = Mesh.MergeMeshes(nodeMeshInfo.nodeMeshes, true, true,
                        undefined, false, true);
                    this.logEssenstial(mergedMesh);

                    if (mergedMesh) {
                        // mergedMesh.skeleton = nodeMeshInfo.nodeSkeleton;
                        mergedMesh.forceSharedVertices();

                        const decimator = new QuadraticErrorSimplification(mergedMesh);
                        decimator.simplify(
                            {
                                quality: 0.6,
                                distance: 1,
                                optimizeMesh: true
                            },
                            (mesh) => {
                                if (mesh) {
                                    this.setParentWrapper(mesh, nodeMeshInfo.nodeParent);
                                    mesh.isVisible = true;
                                    // mesh.forceSharedVertices();
                                    mesh.skeleton = nodeMeshInfo.nodeSkeleton;
                                    this.meshCache[nodeIndex].push(mesh);
                                    mergedMesh.dispose();
                                } else {
                                    mergedMesh.setParent(nodeMeshInfo.nodeParent);
                                    this.meshCache[nodeIndex].push(mergedMesh);
                                }

                                const thisMesh = this.meshCache[nodeIndex][0];
                                this.createImposter(this.meshCache[nodeIndex][0], PhysicsImpostor.SoftbodyImpostor,
                                    options_soft, true,false);


                                if (this.meshCacheInfo.Body?.nodeParent) {
                                    this.meshCacheInfo.Body.nodeParent.computeWorldMatrix(true);
                                    const rigidImposter = (this.meshCacheInfo.Body.nodeParent as Mesh).physicsImpostor;
                                    if (rigidImposter)
                                        this.meshCache[nodeIndex][0].physicsImpostor?.addAnchor(
                                            rigidImposter,
                                            0.5, 0.3,
                                            1.,
                                            false
                                        );
                                }

                                // Flag
                                this._hairReady = true;
                            }
                        )

                        while (this.meshCache[nodeIndex].length) {
                            this.meshCache[nodeIndex].pop();
                        }
                    }
                    break;
            }
        }
    }

    /**
     * Ignore relative transformations from parenting
     * @param mesh Mesh to change parent
     * @param parent Parent to change to
     * @private
     */
    private setParentWrapper(mesh: Mesh, parent: Nullable<Node>) {
        const prePosition = mesh.position.clone();
        const preRotation = mesh.rotation.clone();
        const preScaling = mesh.scaling.clone();
        mesh.setParent(parent);
        mesh.position = prePosition;
        mesh.rotation = preRotation;
        mesh.scaling = preScaling;
    }

    /**
     * Recalculate bounding boxes
     */
    private reCalculateBoundingBox(mesh: Mesh) {
        // Use facet instead of vertices since they can contain
        mesh.updateFacetData();
        console.log(mesh.facetNb);
        const numeric_bound = 1e32;
        const minVector = new Vector3(numeric_bound, numeric_bound, numeric_bound);
        const maxVector = new Vector3(-numeric_bound, -numeric_bound, -numeric_bound);
        let x, y, z;
        for (let i=0; i<mesh.facetNb; i++) {
            const facetPos = mesh.getFacetPosition(i);
            x = facetPos.x;
            y = facetPos.y
            z = facetPos.z;
            if (minVector.x > x)
                minVector.x = x;
            if (minVector.y > y)
                minVector.y = y;
            if (minVector.z > z)
                minVector.z = z;
            if (maxVector.x < x)
                maxVector.x = x;
            if (maxVector.y < y)
                maxVector.y = y;
            if (maxVector.z < z)
                maxVector.z = z;
        }

        const worldMatrix = mesh.getWorldMatrix();
        const transformedMinVector = Vector3.TransformCoordinates(minVector, worldMatrix);
        const transformedMaxVector = Vector3.TransformCoordinates(maxVector, worldMatrix);

        const newCenter = maxVector.add(minVector).multiply(new Vector3(0.5, 0.5, 0.5));
        const transformMatrix = Matrix.Compose(
            new Vector3(1, 1, 1), Quaternion.Identity(), newCenter.negate());

        // // Add a small space over vertices
        // const eps = 0.5;
        // minVector = minVector.subtractFromFloats(eps, eps, eps);
        // maxVector = maxVector.addInPlaceFromFloats(eps, eps, eps);

        const boundingBox = mesh.getBoundingInfo().boundingBox;
        console.log(minVector);
        console.log(maxVector);
        console.log(transformedMinVector);
        console.log(transformedMaxVector);
        console.log(Vector3.TransformCoordinates(boundingBox.center, worldMatrix));
        mesh.setPivotPoint(newCenter);
        mesh.getBoundingInfo().reConstruct(minVector, maxVector);

        // mesh.bakeTransformIntoVertices(transformMatrix);
        // mesh.position = newCenter;
        // mesh.getBoundingInfo().reConstruct(
        //     minVector.subtract(newCenter), maxVector.subtract(newCenter));
    }

    private gatherMeshInfo() {
        const pattern = /^(Body|Face|Hair)\d*_primitive(\d+)$/;
        const meshCacheInfo: MeshCacheInfo = {};
        for (const nodeIndex of Object.keys(this.meshCache).map(Number)) {
            const nodeMeshInfo: NodeMeshInfo = {
                nodeIndex: -1,
                nodeMeshes: [],
                nodeParent: null,
                nodeSkeleton: null,
                nodeType: ""
            }
            for (let index = 0; index < this.meshCache[nodeIndex].length; index++) {
                const primitive = this.meshCache[nodeIndex][index];
                console.log(primitive.name);

                const match = primitive.name.match(pattern);
                if (match) {
                    switch (match[1]) {
                        case "Body":
                            nodeMeshInfo.nodeType = "Body";
                            meshCacheInfo.Body = nodeMeshInfo;
                            break;
                        case "Face":
                            nodeMeshInfo.nodeType = "Face";
                            meshCacheInfo.Face = nodeMeshInfo;
                            break;
                        case "Hair":
                            nodeMeshInfo.nodeType = "Hair";
                            meshCacheInfo.Hair = nodeMeshInfo;
                            break;
                    }

                    // Push meshes
                    nodeMeshInfo.nodeIndex = nodeIndex;
                    nodeMeshInfo.nodeMeshes.push(primitive);
                    // Get parent
                    if (!nodeMeshInfo.nodeParent)
                        nodeMeshInfo.nodeParent = primitive.parent;
                    else
                    if (primitive.parent?.name !== nodeMeshInfo.nodeParent.name)
                        throw new Error("Mesh parent doesn't match!");
                    // Get skeleton
                    if (!nodeMeshInfo.nodeSkeleton)
                        nodeMeshInfo.nodeSkeleton = primitive.skeleton;
                    else
                    if (primitive.skeleton !== nodeMeshInfo.nodeSkeleton)
                        throw new Error("Mesh skeleton doesn't match!");
                }
            }
        }

        return meshCacheInfo;
    }

    private createImposter(
        mesh: Mesh,
        type: number,
        options: PhysicsImpostorParameters,
        ignoreParent: boolean = false,
        reparent: boolean = true,
        recursiveParent: boolean = true,
        showImposter: boolean = true
    ) {
        console.log("createImposter");
        let parent = mesh.parent;
        while (recursiveParent && parent?.parent)
            parent = parent.parent;
        if (reparent) mesh.setParent(null);
        // if (reparent) this.setParentWrapper(mesh, null);

        mesh.physicsImpostor = new PhysicsImpostor(mesh, type,
            {...options, ignoreParent: ignoreParent},
            this.scene);
        if (this.physicsDebug && showImposter)
            try {
                this.physicsViewer.showImpostor(mesh.physicsImpostor, mesh);
            } catch (exc) {
                console.warn(exc);
            }
        if (reparent) mesh.setParent(parent);
        // if (reparent) this.setParentWrapper(mesh, parent);
    }

    private logEssenstial(mesh: Nullable<AbstractMesh> | Nullable<TransformNode>) {
        if (mesh) {
            console.log(mesh.name);
            console.log(mesh.position);
            console.log(mesh.rotation);
            console.log(mesh.scaling);
            console.log(mesh.getWorldMatrix())
            console.log(mesh.rotationQuaternion)
        }
    }
}
