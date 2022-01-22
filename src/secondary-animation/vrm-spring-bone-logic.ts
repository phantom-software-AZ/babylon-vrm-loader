import {Quaternion, Vector3} from '@babylonjs/core/Maths/math';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Nullable} from '@babylonjs/core/types';
import {QuaternionHelper} from './quaternion-helper';
import {SphereCollider} from './sphere-collider';

/**
 * Verlet Spring Bone Logic.
 */
export class VRMSpringBoneLogic {
    /**
     * Cloned initial local rotation
     */
    private localPosition: Vector3;
    private localRotation: Quaternion;
    /**
     * Reference of parent rotation
     */
    private boneAxis: Vector3;
    private boneLength: number;

    private centerAbsolutePos: Vector3;
    private centerSpacePosition: Vector3;
    private parentAbsolutePos: Vector3;
    private currentTail: Vector3;
    private prevTail: Vector3;
    private worldParentQuaternion: Quaternion;

    /**
     * @param center Center reference of TransformNode
     * @param radius Collision Radius
     * @param transform Base TransformNode
     * @param localChildPosition
     */
    public constructor(
        private readonly center: Nullable<TransformNode>,
        public readonly radius: number,
        public readonly transform: TransformNode,
        private readonly localChildPosition: Vector3,
    ) {
        // Initialize rotationQuaternion when not initialized
        if (!transform.rotationQuaternion) {
            transform.rotationQuaternion = transform.rotation.toQuaternion();
        }
        const parent = transform.parent as Nullable<TransformNode>;
        if (parent !== null && parent.rotationQuaternion === null) {
            parent.rotationQuaternion = parent.rotation.toQuaternion();
        }

        this.init();
    }

    private init() {
        this.centerAbsolutePos = this.center ? this.center.absolutePosition : new Vector3(0, 0, 0);
        this.centerSpacePosition = this.transform.absolutePosition.subtract(this.centerAbsolutePos);
        this.parentAbsolutePos = this.transform.parent ?
            (this.transform.parent as TransformNode).absolutePosition : new Vector3(0, 0, 0);
        this.worldParentQuaternion = Quaternion.Identity();

        this.localPosition = this.mirrorY(this.transform.position.clone());
        this.localRotation = this.transform.rotationQuaternion!.clone();
        this.currentTail = this.localToWorld(this.localChildPosition).subtract(this.centerAbsolutePos);
        this.prevTail = this.currentTail.clone();
        this.boneAxis = Vector3.Normalize(this.localChildPosition);
        this.boneLength = this.localChildPosition.length();
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
        const absPos = this.transform.absolutePosition;
        if (Number.isNaN(absPos.x)) {
            // Do not update when absolute position is invalid
            return;
        }

        if (center) {
            this.centerAbsolutePos = center.absolutePosition;
        }
        this.centerSpacePosition = absPos.subtract(this.centerAbsolutePos);
        this.parentAbsolutePos = this.transform.parent ?
            (this.transform.parent as TransformNode).absolutePosition : new Vector3(0, 0, 0);

        this.worldParentQuaternion = this.transform.parent ? Quaternion.FromRotationMatrix(
                        this.transform.parent.getWorldMatrix().getRotationMatrix()) : Quaternion.Identity();

        const currentTail = this.currentTail;
        const prevTail = this.prevTail;
        // if (this.transform.name === "9aeaa5b9-60a0-40da-ae19-e979c7395685") {

        // verlet 積分で次の位置を計算
        let nextTail = this.currentTail.clone();

        // Momentum/Drag
        const delta = currentTail.subtract(prevTail).scaleInPlace(1.0 - dragForce);
        nextTail.addInPlace(delta);

        // 親の回転による子ボーンの移動目標
        const rotation1 = this.localRotation.clone();
        const rotation2 = this.worldParentQuaternion.clone();
        const rotatedVec = Vector3.Zero();
        this.boneAxis.rotateByQuaternionToRef(rotation1, rotatedVec); // rotation * boneAxis
        rotatedVec.addInPlace(this.localPosition);
        rotatedVec.rotateByQuaternionToRef(rotation2, rotatedVec); // rotation * boneAxis
        rotatedVec.addInPlace(this.parentAbsolutePos).subtractInPlace(absPos).normalize();
        const stiffedVec = rotatedVec.scale(stiffnessForce); // rotatedVec * stiffnessForce
        nextTail.addInPlace(stiffedVec); // nextTail + stiffedVec

        // 外力による移動量
        nextTail.addInPlace(external);

        // 長さを boneLength に強制
        const diff = nextTail.subtract(this.centerSpacePosition);
        diff.normalize();
        diff.scaleInPlace(this.boneLength)
        nextTail = this.centerSpacePosition.add(diff);

        // Collision で移動
        nextTail = this.collide(colliders, nextTail);

        this.prevTail = currentTail;
        this.currentTail = nextTail;

        // 回転を適用
        const r = this.transformToRotationLocal(nextTail);
        this.transform.rotationQuaternion = this.localRotation.multiply(r);
    }

    private localToWorld(pos: Vector3): Vector3 {
        const rotatedPos = pos.clone();
        pos.rotateByQuaternionToRef(
            this.worldParentQuaternion.multiply(this.transform.rotationQuaternion!), rotatedPos);
        rotatedPos.addInPlace(this.transform.absolutePosition);
        return rotatedPos;
    }

    private transformToRotationLocal(nextTail: Vector3): Quaternion {
        const initialCenterSpaceQuaternionR1 = Quaternion.Inverse(this.localRotation);
        const initialCenterSpaceQuaternionR2 = Quaternion.Inverse(this.worldParentQuaternion);
        const fromAxis = this.boneAxis.clone();
        const toAxis = Vector3.Zero();
        nextTail.add(this.centerAbsolutePos).subtract(this.parentAbsolutePos)
            .rotateByQuaternionToRef(initialCenterSpaceQuaternionR2, toAxis);
        toAxis.subtract(this.localPosition).rotateByQuaternionToRef(initialCenterSpaceQuaternionR1, toAxis);

        toAxis.normalize();
        return QuaternionHelper.fromToRotation(fromAxis, toAxis);
    }

    /**
     * 衝突判定を行う
     * @param colliders SphereColliders
     * @param nextTail NextTail
     */
    private collide(colliders: SphereCollider[], nextTail: Vector3): Vector3 {
        colliders.forEach((collider) => {
            // Collider position passed in are actually AbsPos
            const colliderCenterSpacePosition = collider.position.subtract(this.centerAbsolutePos);
            // Manual parenting
            colliderCenterSpacePosition.addInPlace(this.centerSpacePosition);
            const r = this.radius + collider.radius;
            const axis = nextTail.subtract(colliderCenterSpacePosition);
                // 少数誤差許容のため 2 cm 判定を小さくする
            if (axis.lengthSquared() <= (r * r) - 0.02) {
                // ヒット。 Collider の半径方向に押し出す
                const posFromCollider = colliderCenterSpacePosition.add(axis.normalize().scaleInPlace(r));
                // 長さを boneLength に強制
                nextTail = posFromCollider
                    .subtractInPlace(this.centerSpacePosition)
                    .normalize()
                    .scaleInPlace(this.boneLength)
                    .addInPlace(this.centerSpacePosition);
            }
        });
        return nextTail;
    }

    private mirrorY(v: Vector3) {
        return new Vector3(v.x, -v.y, v.z);
    }
}
