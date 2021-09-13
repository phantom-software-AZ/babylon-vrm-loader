import { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Nullable } from '@babylonjs/core/types';
import { GLTFLoader, IGLTFLoaderExtension, IMaterial, IMeshPrimitive } from '@babylonjs/loaders/glTF/2.0';
import { VRMManager } from './vrm-manager';
import { VRMMaterialGenerator } from './vrm-material-generator';
import {Geometry} from "@babylonjs/core/Meshes/geometry";
import {VRMFileLoader} from "./vrm-file-loader";

/**
 * `extensions` に入る拡張キー
 */
const NAME = 'VRM';

/**
 * VRM 拡張を処理する
 * [Specification](https://github.com/vrm-c/UniVRM/tree/master/specification/)
 */
export class VRMExtension implements IGLTFLoaderExtension {
    /**
     * @inheritdoc
     */
    public readonly name = NAME;
    /**
     * @inheritdoc
     */
    public enabled = true;
    /**
     * この Mesh index 以降が読み込み対象
     */
    private meshesFrom = 0;
    /**
     * この TransformNode index 以降が読み込み対象
     */
    private transformNodesFrom = 0;

    /**
     * @inheritdoc
     */
    public constructor(
        private loader: GLTFLoader,
    ) {
        // GLTFLoader has already added rootMesh as __root__ before load extension
        // @see glTFLoader._loadData
        this.meshesFrom = this.loader.babylonScene.meshes.length - 1;
        this.transformNodesFrom = this.loader.babylonScene.transformNodes.length;
    }

    /**
     * @inheritdoc
     */
    public dispose(): void {
        (this.loader as any) = null;
    }

    /**
     * @inheritdoc
     */
    public onReady() {
        if (!this.loader.gltf.extensions || !this.loader.gltf.extensions[NAME]) {
            return;
        }
        const scene = this.loader.babylonScene;

        // VRM doesn't have any UID in metadata
        // Title can be unfilled too. Filename is the only reasonable ID.
        this.loader.gltf.extensions[NAME].meta.fileName = (this.loader.parent as unknown as VRMFileLoader).fileName;
        const manager = new VRMManager(
            this.loader.gltf.extensions[NAME],
            this.loader.babylonScene,
            this.meshesFrom,
            this.transformNodesFrom,
        );
        scene.metadata = scene.metadata || {};
        scene.metadata.vrmManagers = scene.metadata.vrmManagers || [];
        scene.metadata.vrmManagers.push(manager);
        scene.metadata.getVRMManagerByFileName = scene.metadata.getVRMManagerByFileName
            || ((fileName: String) => {
                for (const manager of scene.metadata.vrmManagers) {
                    if (manager.ext.meta.fileName === fileName)
                        return manager;
                }
                return null;
            });
        this.loader.babylonScene.onDisposeObservable.add(() => {
            // Scene dispose 時に Manager も破棄する
            manager.dispose();
            this.loader.babylonScene.metadata.vrmManagers = [];
        });
        console.log("extension onReady");
    }

    /**
     * @inheritdoc
     */
    public _loadVertexDataAsync(
        context: string,
        primitive: IMeshPrimitive,
        babylonMesh: Mesh,
    ): Nullable<Promise<Geometry>> {
        if (!primitive.extras || !primitive.extras.targetNames) {
            return null;
        }
        // まだ MorphTarget が生成されていないので、メタ情報にモーフターゲット情報を入れておく
        babylonMesh.metadata = babylonMesh.metadata || {};
        babylonMesh.metadata.vrmTargetNames = primitive.extras.targetNames;
        return null;
    }

    /**
     * @inheritdoc
     */
    public _loadMaterialAsync(
        context: string,
        material: IMaterial,
        mesh: Mesh,
        babylonDrawMode: number,
        assign: (babylonMaterial: Material) => void,
    ): Nullable<Promise<Material>> {
        // ジェネレータでマテリアルを生成する
        return (new VRMMaterialGenerator(this.loader)).generate(context, material, mesh, babylonDrawMode, assign);
    }
}

// ローダーに登録する
export const registerVrmExtension = () => {
    GLTFLoader.RegisterExtension(NAME, (loader) => new VRMExtension(loader));
};
