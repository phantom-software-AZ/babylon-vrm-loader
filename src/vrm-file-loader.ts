import { GLTFFileLoader } from '@babylonjs/loaders/glTF/glTFFileLoader';
import { Nullable } from '@babylonjs/core/types';
import {VRMManager} from "./vrm-manager";
import {Scene} from "@babylonjs/core/scene";
import {ISceneLoaderProgressEvent} from "@babylonjs/core/Loading/sceneLoader";

/**
 * VRM/VCI ファイルを読み込めるようにする
 * 拡張子を変更しただけ
 */
export class VRMFileLoader extends GLTFFileLoader {
  public name = 'vrm';
  public extensions = {
    '.vrm': { isBinary: true },
    '.vci': { isBinary: true },
  };
  public uri: string;
  public vrmManager: Nullable<VRMManager> = null;

  public createPlugin() {
      return new VRMFileLoader();
  }

  public loadAsync(
      scene: Scene,
      data: any,
      rootUrl: string,
      onProgress?: (event: ISceneLoaderProgressEvent) => void,
      fileName?: string): Promise<void> {
    this.uri = rootUrl;
    if (fileName)
        this.uri += fileName;
    return super.loadAsync(scene, data, rootUrl, onProgress, fileName);
  }
}
