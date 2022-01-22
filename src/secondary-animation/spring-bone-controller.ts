import { Vector3 } from '@babylonjs/core/Maths/math';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Nullable } from '@babylonjs/core/types';
import { IVRMSecondaryAnimation } from '../vrm-interfaces';
import { ColliderGroup } from './collider-group';
import { VRMSpringBone } from './vrm-spring-bone';

/**
 * function to get bone from nodeIndex
 */
type getBone = (nodeIndex: number) => Nullable<TransformNode>;

/**
 * Options for creating springs
 */
export interface ConstructSpringsOptions {
    /**
     * The resilience of the swaying object
     */
    stiffness?: number;
    /**
     * The strength of gravity
     */
    gravityPower?: number;
    /**
     * The direction of gravity. Set (0, -1, 0) for simulating the gravity. Set (1, 0, 0) for simulating the wind.
     */
    gravityDir?: Vector3;
     /**
     * The resistance (deceleration) of automatic animation
     */
     dragForce?: number;
    /**
     * The radius of the sphere used for the collision detection with colliders
     */
    hitRadius?: number;
}

/**
 * VRM SpringBone Controller
 */
export class SpringBoneController {
    /**
     * Spring Bone List
     */
    private springs: VRMSpringBone[];

    /**
     * @param ext SecondaryAnimation Object
     * @param getBone
     * @param options Override for constructSprings
     */
    public constructor(
        public readonly ext: IVRMSecondaryAnimation,
        getBone: getBone,
        options?: ConstructSpringsOptions
    ) {
        const colliderGroups = this.constructColliderGroups(getBone);
        this.springs = this.constructSprings(getBone, colliderGroups, options);
    }

    public dispose() {
        this.springs = [];
    }

    /**
     * Initialize SpringBones
     */
    public setup(force = false) {
        this.springs.forEach((spring) => {
            spring.setup(force);
        });
    }

    /**
     * Update all SpringBones
     *
     * @param deltaTime Elapsed sec from previous frame
     * @param boneOptions options for updating bones
     * @see https://docs.unity3d.com/ScriptReference/Time-deltaTime.html
     */
    public async update(deltaTime: number, boneOptions?: ConstructSpringsOptions): Promise<void> {
        // ポーズ後のあらぶり防止のため clamp
        deltaTime = Math.max(0.0, Math.min(125, deltaTime)) / 1000;
        const promises = this.springs.map<Promise<void>>((spring) => {
            return spring.update(deltaTime, boneOptions);
        });
        return Promise.all(promises).then(() => { /* Do nothing */ });
    }

    private constructColliderGroups(getBone: getBone) {
        if (!this.ext.colliderGroups || !this.ext.colliderGroups.length) {
            return [];
        }
        const colliderGroups: ColliderGroup[] = [];
        this.ext.colliderGroups.forEach((colliderGroup) => {
            const bone = getBone(colliderGroup.node) as TransformNode;
            const g = new ColliderGroup(bone);
            colliderGroup.colliders.forEach((collider) => {
                g.addCollider(
                    // Unity 座標系からの変換のため X, Z 軸を反転
                    new Vector3(-collider.offset.x, collider.offset.y, -collider.offset.z),
                    collider.radius,
                );
            });
            colliderGroups.push(g);
        });
        return colliderGroups;
    }

    private constructSprings(getBone: getBone, colliderGroups: ColliderGroup[],
                             options?: ConstructSpringsOptions) {
        if (!this.ext.boneGroups || !this.ext.boneGroups.length) {
            return [];
        }
        const springs: VRMSpringBone[] = [];
        this.ext.boneGroups.forEach((spring) => {
            const rootBones = (spring.bones || []).map((bone) => {
                return getBone(bone) as TransformNode;
            });
            const springColliders = (spring.colliderGroups || []).map<ColliderGroup>((g) => {
                return colliderGroups[g];
            });
            springs.push(new VRMSpringBone(
                spring.comment,
                options?.stiffness
                    ? options.stiffness
                    : spring.stiffiness,
                options?.gravityPower
                    ? options.gravityPower
                    : spring.gravityPower,
                options?.gravityDir
                    ? options.gravityDir
                    : new Vector3(
                    // Unity 座標系からの変換のため X, Z 軸を反転
                    -spring.gravityDir.x,
                    spring.gravityDir.y,
                    -spring.gravityDir.z,
                ).normalize(),
                options?.dragForce
                ? options.dragForce
                : spring.dragForce,
                getBone(spring.center),
                options?.hitRadius
                ? options.hitRadius
                : spring.hitRadius,
                rootBones,
                springColliders,
            ));
        });
        return springs;
    }
}
