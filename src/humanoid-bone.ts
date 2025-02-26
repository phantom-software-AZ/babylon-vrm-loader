import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Nullable } from '@babylonjs/core/types';
import { BoneNotFoundError } from './errors';

export interface TransformNodeMap {
    [name: string]: TransformNode;
}

/**
 * HumanoidBone を取得するメソッド群
 * @see https://docs.unity3d.com/ja/2018.3/ScriptReference/HumanBodyBones.html
 */
export class HumanoidBone {
    private readonly _nodeMap: TransformNodeMap;
    get nodeMap(): TransformNodeMap {
        return this._nodeMap;
    }

    public constructor(
        nodeMap: TransformNodeMap
    ) {
        this._nodeMap = nodeMap;
    }

    public dispose() {
        (this._nodeMap as any) = null;
    }

    /**
     * 尻
     */
    public get hips() {
        return this.getMandatoryBone('hips');
    }
    /**
     * 左太もも
     */
    public get leftUpperLeg() {
        return this.getMandatoryBone('leftUpperLeg');
    }
    /**
     * 右太もも
     */
    public get rightUpperLeg() {
        return this.getMandatoryBone('rightUpperLeg');
    }
    /**
     * 左ひざ
     */
    public get leftLowerLeg() {
        return this.getMandatoryBone('leftLowerLeg');
    }
    /**
     * 右ひざ
     */
    public get rightLowerLeg() {
        return this.getMandatoryBone('rightLowerLeg');
    }
    /**
     * 左足首
     */
    public get leftFoot() {
        return this.getMandatoryBone('leftFoot');
    }
    /**
     * 右足首
     */
    public get rightFoot() {
        return this.getMandatoryBone('rightFoot');
    }
    /**
     * 脊椎の第一
     */
    public get spine() {
        return this.getMandatoryBone('spine');
    }
    /**
     * 胸
     */
    public get chest() {
        return this.getMandatoryBone('chest');
    }
    /**
     * 首
     */
    public get neck() {
        return this.getMandatoryBone('neck');
    }
    /**
     * 頭
     */
    public get head() {
        return this.getMandatoryBone('head');
    }
    /**
     * 左肩
     */
    public get leftShoulder() {
        return this.getMandatoryBone('leftShoulder');
    }
    /**
     * 右肩
     */
    public get rightShoulder() {
        return this.getMandatoryBone('rightShoulder');
    }
    /**
     * 左上腕
     */
    public get leftUpperArm() {
        return this.getMandatoryBone('leftUpperArm');
    }
    /**
     * 右上腕
     */
    public get rightUpperArm() {
        return this.getMandatoryBone('rightUpperArm');
    }
    /**
     * 左ひじ
     */
    public get leftLowerArm() {
        return this.getMandatoryBone('leftLowerArm');
    }
    /**
     * 右ひじ
     */
    public get rightLowerArm() {
        return this.getMandatoryBone('rightLowerArm');
    }
    /**
     * 左手首
     */
    public get leftHand() {
        return this.getMandatoryBone('leftHand');
    }
    /**
     * 右手首
     */
    public get rightHand() {
        return this.getMandatoryBone('rightHand');
    }
    /**
     * 左つま先(Optional)
     */
    public get leftToes(): Nullable<TransformNode> {
        return this.getOptionalBone('leftToes');
    }
    /**
     * 右つま先(Optional)
     */
    public get rightToes(): Nullable<TransformNode> {
        return this.getOptionalBone('rightToes');
    }
    /**
     * 左目(Optional)
     */
    public get leftEye(): Nullable<TransformNode> {
        return this.getOptionalBone('leftEye');
    }
    /**
     * 右目(Optional)
     */
    public get rightEye(): Nullable<TransformNode> {
        return this.getOptionalBone('rightEye');
    }
    /**
     * 顎(Optional)
     */
    public get jaw(): Nullable<TransformNode> {
        return this.getOptionalBone('jaw');
    }
    /**
     * 左親指第一指骨(Optional)
     */
    public get leftThumbProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftThumbProximal');
    }
    /**
     * 左親指第二指骨(Optional)
     */
    public get leftThumbIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('leftThumbIntermediate');
    }
    /**
     * 左親指第三指骨(Optional)
     */
    public get leftThumbDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftThumbDistal');
    }
    /**
     * 左人差し指第一指骨(Optional)
     */
    public get leftIndexProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftIndexProximal');
    }
    /**
     * 左人差し指第二指骨(Optional)
     */
    public get leftIndexIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('leftIndexIntermediate');
    }
    /**
     * 左人差し指第三指骨(Optional)
     */
    public get leftIndexDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftIndexDistal');
    }
    /**
     * 左中指第一指骨(Optional)
     */
    public get leftMiddleProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftMiddleProximal');
    }
    /**
     * 左中指第二指骨(Optional)
     */
    public get leftMiddleIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('leftMiddleIntermediate');
    }
    /**
     * 左中指第三指骨(Optional)
     */
    public get leftMiddleDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftMiddleDistal');
    }
    /**
     * 左薬指第一指骨(Optional)
     */
    public get leftRingProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftRingProximal');
    }
    /**
     * 左薬指第二指骨(Optional)
     */
    public get leftRingIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('leftRingIntermediate');
    }
    /**
     * 左薬指第三指骨(Optional)
     */
    public get leftRingDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftRingDistal');
    }
    /**
     * 左小指第一指骨(Optional)
     */
    public get leftLittleProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftLittleProximal');
    }
    /**
     * 左小指第二指骨(Optional)
     */
    public get leftLittleIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('leftLittleIntermediate');
    }
    /**
     * 左小指第三指骨(Optional)
     */
    public get leftLittleDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('leftLittleDistal');
    }
    /**
     * 右親指第一指骨(Optional)
     */
    public get rightThumbProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightThumbProximal');
    }
    /**
     * 右親指第二指骨(Optional)
     */
    public get rightThumbIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('rightThumbIntermediate');
    }
    /**
     * 右親指第三指骨(Optional)
     */
    public get rightThumbDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightThumbDistal');
    }
    /**
     * 右人差し指第一指骨(Optional)
     */
    public get rightIndexProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightIndexProximal');
    }
    /**
     * 右人差し指第二指骨(Optional)
     */
    public get rightIndexIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('rightIndexIntermediate');
    }
    /**
     * 右人差し指第三指骨(Optional)
     */
    public get rightIndexDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightIndexDistal');
    }
    /**
     * 右中指第一指骨(Optional)
     */
    public get rightMiddleProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightMiddleProximal');
    }
    /**
     * 右中指第二指骨(Optional)
     */
    public get rightMiddleIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('rightMiddleIntermediate');
    }
    /**
     * 右中指第三指骨(Optional)
     */
    public get rightMiddleDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightMiddleDistal');
    }
    /**
     * 右薬指第一指骨(Optional)
     */
    public get rightRingProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightRingProximal');
    }
    /**
     * 右薬指第二指骨(Optional)
     */
    public get rightRingIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('rightRingIntermediate');
    }
    /**
     * 右薬指第三指骨(Optional)
     */
    public get rightRingDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightRingDistal');
    }
    /**
     * 右小指第一指骨(Optional)
     */
    public get rightLittleProximal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightLittleProximal');
    }
    /**
     * 右小指第二指骨(Optional)
     */
    public get rightLittleIntermediate(): Nullable<TransformNode> {
        return this.getOptionalBone('rightLittleIntermediate');
    }
    /**
     * 右小指第三指骨(Optional)
     */
    public get rightLittleDistal(): Nullable<TransformNode> {
        return this.getOptionalBone('rightLittleDistal');
    }
    /**
     * 上胸(Optional)
     */
    public get upperChest(): Nullable<TransformNode> {
        return this.getOptionalBone('upperChest');
    }

    /**
     * 必須ボーンを取得する。取得出来ない場合は例外を発生する
     *
     * @throws BoneNotFoundError
     * @param name HumanoidBoneName
     */
    private getMandatoryBone(name: string): TransformNode {
        const node = this.nodeMap[name];
        if (!node) {
            throw new BoneNotFoundError(name);
        }
        return node;
    }

    /**
     * オプショナルボーンを取得する
     *
     * @param name HumanoidBoneName
     */
    private getOptionalBone(name: string): Nullable<TransformNode> {
        return this.nodeMap && this.nodeMap[name] || null;
    }
}
