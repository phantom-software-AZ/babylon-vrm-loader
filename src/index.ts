import {registerPlugin} from "./vrm-file-loader";
import {registerVrmExtension} from "./vrm-extension";
import {registerVciExtension} from "./vcast-vci-material-unity";

export * from './errors';
export * from './humanoid-bone';
export * from './vcast-vci-material-unity';
export * from './vci-interfaces';
export * from './vrm-extension';
export * from './vrm-file-loader';
export * from './vrm-interfaces';
export * from './vrm-manager';
export * from './vrm-material-generator';

export const loadVrmManager = () => {
    registerPlugin();
    registerVrmExtension();
    registerVciExtension();
};
