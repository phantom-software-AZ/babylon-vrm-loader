import { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Nullable } from '@babylonjs/core/types';
import { GLTFLoader, IGLTFLoaderExtension, IMaterial, IMeshPrimitive } from '@babylonjs/loaders/glTF/2.0';
import { VRMManager } from './vrm-manager';
import { VRMMaterialGenerator } from './vrm-material-generator';
import {Geometry} from "@babylonjs/core/Meshes/geometry";
import {VRMFileLoader} from "./vrm-file-loader";
import {GLTFLoaderExtensionObserver} from "../../loader-observer";
import {V3DCore} from "../../../index";


/**
 * VRM 拡張を処理する
 * [Specification](https://github.com/vrm-c/UniVRM/tree/master/specification/)
 */
export class VRMLoaderExtension implements IGLTFLoaderExtension {

    /**
     * `extensions` に入る拡張キー
     */
    public static readonly NAME = 'VRM';

    /**
     * @inheritdoc
     */
    public readonly name = VRMLoaderExtension.NAME;
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
     * Loader observers
     */
    private loaderObservers: GLTFLoaderExtensionObserver[] = [];

    private onLoadedCallBack: Function;

    /**
     * VRM Manager from this load.
     */
    private manager: VRMManager;

    /**
     * @inheritdoc
     */
    public constructor(
        private loader: GLTFLoader,
        private v3DCore: V3DCore,
    ) {
        // GLTFLoader has already added rootMesh as __root__ before load extension
        // @see glTFLoader._loadData
        this.meshesFrom = this.loader.babylonScene.meshes.length - 1;
        this.transformNodesFrom = this.loader.babylonScene.transformNodes.length;
        this.addLoaderObserver(this.v3DCore);
        this.onLoadedCallBack = () => {
            v3DCore.addVRMManager(this.manager);
        };
        v3DCore.addOnLoadCompleteCallbacks(this.onLoadedCallBack);
    }

    /**
     * @inheritdoc
     */
    public dispose(): void {
        (this.loader as any) = null;
        this.loaderObservers = [];
        this.v3DCore.removeOnLoadCompleteCallback(this.onLoadedCallBack);
    }

    /**
     * @inheritdoc
     */
    public onReady() {
        if (!this.loader.gltf.extensions || !this.loader.gltf.extensions[VRMLoaderExtension.NAME]) {
            return;
        }

        // Because of the way loader plugin works, this seems to be
        // the best we can do
        const uri = (this.loader.parent as unknown as VRMFileLoader).uri;
        this.manager = new VRMManager(
            this.loader.gltf.extensions[VRMLoaderExtension.NAME],
            this.loader.babylonScene,
            this.meshesFrom,
            this.transformNodesFrom,
            uri,
        );
        this.loader.babylonScene.onDisposeObservable.add(() => {
            // Scene dispose 時に Manager も破棄する
            this.manager.dispose();
        });

        // Inform observers
        for (const observer of this.loaderObservers) {
            observer.onLoadReady();
        }
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

    /**
     * Add observer
     */
    public addLoaderObserver(observer: GLTFLoaderExtensionObserver) {
        this.loaderObservers.push(observer);
    }
}
