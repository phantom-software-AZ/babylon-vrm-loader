import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Nullable } from '@babylonjs/core/types';
import { QuaternionHelper } from './quaternion-helper';
import { SphereCollider } from './sphere-collider';
import { Vector3Helper } from './vector3-helper';
import { Matrix } from "@babylonjs/core/Maths/math";

/**
 * Verlet Spring Bone Logic
 * TODO: collider is still kind of buggy. Internal meshes sometimes move outside external meshes.
 */
export class VRMSpringBoneLogic {
    /**
     * Cloned initial local rotation
     */
    private readonly localRotation: Quaternion;
    /**
     * Reference of parent rotation
     */
    private readonly boneAxis: Vector3;
    private readonly boneLength: number;

    private centerAbsolutePos: Vector3;
    private currentTail: Vector3;
    private prevTail: Vector3;

    /**
     * @param center Center reference of TransformNode
     * @param radius Collision Radius
     * @param transform Base TransformNode
     * @param localChildPosition
     */
    public constructor(
        center: Nullable<TransformNode>,
        public readonly radius: number,
        public readonly transform: TransformNode,
        localChildPosition: Vector3,
    ) {
        // Initialize rotationQuaternion when not initialized
        if (!transform.rotationQuaternion) {
            transform.rotationQuaternion = transform.rotation.toQuaternion();
        }
        const parent = transform.parent as Nullable<TransformNode>;
        if (parent !== null && parent.rotationQuaternion === null) {
            parent.rotationQuaternion = parent.rotation.toQuaternion();
        }

        const worldChildPosition = transform.getAbsolutePosition().add(localChildPosition);
        this.centerAbsolutePos = center ? center.getAbsolutePosition() : new Vector3(0, 0, 0);
        this.currentTail = this.getCenterTranslatedPos(worldChildPosition);
        this.prevTail = this.currentTail;
        this.localRotation = transform.rotationQuaternion.clone();
        this.boneAxis = Vector3.Normalize(localChildPosition);
        this.boneLength = localChildPosition.length();
    }

    /**
     * Update Tail position
     *
     * @param center Center reference of TransformNode
     * @param stiffnessForce Current frame stiffness
     * @param dragForce Current frame drag force
     * @param external Current frame external force
     * @param colliders Current frame colliders
     */
    public update(
        center: Nullable<TransformNode>,
        stiffnessForce: number,
        dragForce: number,
        external: Vector3,
        colliders: SphereCollider[],
    ): void {
        const absPos = this.transform.getAbsolutePosition();
        if (Number.isNaN(absPos.x)) {
            // Do not update when absolute position is invalid
            return;
        }

        // Only update Absolute position once! It is expensive.
        this.centerAbsolutePos = center ? center.getAbsolutePosition() : new Vector3(0, 0, 0);
        const currentTail = this.getCenterTranslatedWorldPos(this.currentTail);
        const prevTail = this.getCenterTranslatedWorldPos(this.prevTail);

        // verlet 積分で次の位置を計算
        let nextTail = currentTail;
        {
            // 減衰付きで前のフレームの移動を継続
            const attenuation = 1.0 - dragForce;
            const delta = Vector3Helper.multiplyByFloat(currentTail.subtract(prevTail), attenuation);
            nextTail.addInPlace(delta);
        }
        {
            // 親の回転による子ボーンの移動目標
            const rotation = this.getAbsoluteRotationQuaternion(this.transform.parent as TransformNode)
                .multiply(this.localRotation); // parentRotation * localRotation
            const rotatedVec = QuaternionHelper.multiplyWithVector3(rotation, this.boneAxis); // rotation * boneAxis
            const stiffedVec = Vector3Helper.multiplyByFloat(rotatedVec, stiffnessForce); // rotatedVec * stiffnessForce
            nextTail.addInPlace(stiffedVec); // nextTail + stiffedVec
        }
        {
            // 外力による移動量
            nextTail.addInPlace(external);
        }
        {
            // 長さを boneLength に強制
            const normalized = nextTail.subtract(absPos).normalize();
            nextTail = absPos.add(Vector3Helper.multiplyByFloat(normalized, this.boneLength));
        }

        {
            // Collision で移動
            nextTail = this.collide(colliders, nextTail);
        }

        this.prevTail = this.getCenterTranslatedPos(currentTail);
        this.currentTail = this.getCenterTranslatedPos(nextTail);

        // 回転を適用
        this.setAbsoluteRotationQuaternion(this.transform, this.transformToRotation(nextTail));
    }

    /**
     * Set Rotation Quaternion in world space.
     * @param node Node to set rotation
     * @param quatRotation Quaternion to set
     * @private
     */
    private setAbsoluteRotationQuaternion(node: TransformNode, quatRotation: Quaternion) {
        if (node.parent) {
            const positionOrig = new Vector3(0, 0, 0);
            const scalingOrig = new Vector3(0, 0, 0);
            const quatRotationNew = Quaternion.Identity();
            const tempWorldMatrix = Matrix.Identity();

            node.getWorldMatrix().decompose(
                scalingOrig, Quaternion.Identity(), positionOrig);
            Matrix.ComposeToRef(scalingOrig, quatRotation, positionOrig, tempWorldMatrix);

            const diffMatrix = Matrix.Identity();
            const invParentMatrix = Matrix.Identity();
            node.parent.computeWorldMatrix(false);   // Since only used after transformToRotation
            node.parent.getWorldMatrix().invertToRef(invParentMatrix);
            tempWorldMatrix.multiplyToRef(invParentMatrix, diffMatrix);
            diffMatrix.decompose(
                new Vector3(0, 0, 0), quatRotationNew, new Vector3(0, 0, 0));

            if (node.rotationQuaternion) {
                node.rotationQuaternion.copyFrom(quatRotationNew);
            } else {
                quatRotationNew.toEulerAnglesToRef(node.rotation);
            }
        } else {
            node.rotationQuaternion = quatRotation;
        }
    }

    private getAbsoluteRotationQuaternion(node: Nullable<TransformNode>) : Quaternion {
        const quatRotation = Quaternion.Identity();
        node?.getWorldMatrix().decompose(
            new Vector3(0, 0, 0), quatRotation, new Vector3(0, 0, 0)
        );
        return quatRotation;
    }

    private getCenterTranslatedWorldPos(pos: Vector3): Vector3 {
        if (this.centerAbsolutePos) {
            return this.centerAbsolutePos.add(pos);
        }
        return pos;
    }

    private getCenterTranslatedPos(pos: Vector3): Vector3 {
        if (this.centerAbsolutePos) {
            return pos.subtract(this.centerAbsolutePos);
        }
        return pos;
    }

    /**
     * 次のテールの位置情報から回転情報を生成する
     *
     * @see https://stackoverflow.com/questions/51549366/what-is-the-math-behind-fromtorotation-unity3d
     */
    private transformToRotation(nextTail: Vector3): Quaternion {
        const rotation = this.getAbsoluteRotationQuaternion(this.transform.parent as TransformNode)
            .multiply(this.localRotation);
        const fromAxis = QuaternionHelper.multiplyWithVector3(rotation, this.boneAxis);
        const toAxis = nextTail.subtract(this.transform.absolutePosition).normalize();
        const result = QuaternionHelper.fromToRotation(fromAxis, toAxis);
        return result.multiplyInPlace(rotation);
    }

    /**
     * 衝突判定を行う
     * @param colliders SphereColliders
     * @param nextTail NextTail
     */
    private collide(colliders: SphereCollider[], nextTail: Vector3): Vector3 {
        colliders.forEach((collider) => {
            const r = this.radius + collider.radius;
            const axis = nextTail.subtract(collider.position);
            // 少数誤差許容のため 2 cm 判定を小さくする
            if (axis.lengthSquared() <= (r * r) - 0.02) {
                // ヒット。 Collider の半径方向に押し出す
                const posFromCollider = collider.position.add(Vector3Helper.multiplyByFloat(axis.normalize(), r));
                // 長さを boneLength に強制
                const absPos = this.transform.absolutePosition;
                nextTail = absPos.add(Vector3Helper.multiplyByFloat(posFromCollider.subtractInPlace(absPos).normalize(), this.boneLength));
            }
        });
        return nextTail;
    }
}
