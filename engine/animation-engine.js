/**
 * Shadow Samurai - Advanced Procedural Animation & Inverse Kinematics Engine
 * Features:
 * - Upper-body / Lower-body animation layering and smooth blending
 * - Procedural Foot IK and floor grounding (Spec 146)
 * - Animation Event dispatching (AttackStart, HitboxEnable, Footstep, etc.) (Spec 144)
 * - Directional hit reactions (LEFT, RIGHT, FRONT, BACK, ABOVE) (Spec 147)
 * - Damage location differentiation (HEAD, BODY, LEGS) (Spec 161)
 * - Procedural opponent facing and orientation smoothing (Spec 145)
 */

class AnimationEngine {
  constructor(fighter) {
    this.fighter = fighter;
    
    // Animation Blending & Layering
    this.currentAnim = 'idle';
    this.targetAnim = 'idle';
    this.animTime = 0;
    this.blendWeight = 1.0; // 0 to 1 transition
    this.blendSpeed = 8.0;  // Blending rate per second
    
    // Separate Upper and Lower Body Layers (Spec 144)
    this.upperBodyAnim = 'idle';
    this.lowerBodyAnim = 'idle';
    this.upperBodyTime = 0;
    this.lowerBodyTime = 0;
    
    // Directional Hit Reaction State (Spec 147)
    this.hitReaction = {
      active: false,
      direction: 'FRONT', // 'FRONT', 'BACK', 'LEFT', 'RIGHT', 'ABOVE'
      intensity: 'light', // 'light', 'medium', 'heavy', 'launch', 'knockdown'
      location: 'BODY',   // 'HEAD', 'BODY', 'LEGS' (Spec 161)
      timer: 0,
      duration: 0.35,
      flinchAngle: 0
    };
    
    // Foot IK & Ground Alignment (Spec 146)
    this.footIK = {
      leftFootY: 0,
      rightFootY: 0,
      leftGrounded: true,
      rightGrounded: true,
      pelvisOffset: 0,
      floorY: 420
    };
    
    // Weapon Position & Trail State
    this.weaponPos = { x: 0, y: 0, angle: 0 };
    this.trailPoints = [];
    this.isTrailActive = false;
    
    // Dispatched Animation Events cache to avoid duplicate fires in same frame
    this.dispatchedEvents = new Set();
  }

  // Play animation with blending
  play(animName, blendDuration = 0.12) {
    if (this.currentAnim === animName && this.blendWeight >= 1.0) return;
    this.targetAnim = animName;
    this.animTime = 0;
    this.blendWeight = 0.0;
    this.blendSpeed = blendDuration > 0 ? (1.0 / blendDuration) : 100.0;
    this.dispatchedEvents.clear();
  }

  // Set Upper / Lower Body Layer split (Spec 144)
  setLayeredAnim(upperAnim, lowerAnim) {
    this.upperBodyAnim = upperAnim;
    this.lowerBodyAnim = lowerAnim;
  }

  // Trigger Directional Hit Reaction (Spec 147, 161)
  triggerHitReaction(direction = 'FRONT', intensity = 'medium', location = 'BODY') {
    this.hitReaction.active = true;
    this.hitReaction.direction = direction;
    this.hitReaction.intensity = intensity;
    this.hitReaction.location = location;
    this.hitReaction.timer = 0;

    let flinch = 0.25;
    let dur = 0.25;

    if (intensity === 'light') {
      flinch = 0.15;
      dur = 0.20;
    } else if (intensity === 'heavy') {
      flinch = 0.45;
      dur = 0.45;
    } else if (intensity === 'launch' || intensity === 'knockdown') {
      flinch = 0.85;
      dur = 0.70;
    }

    if (direction === 'BACK') flinch = -flinch;
    if (direction === 'ABOVE') this.footIK.pelvisOffset = 18;

    this.hitReaction.flinchAngle = flinch;
    this.hitReaction.duration = dur;

    // Dispatch hit animation event
    this.emitEvent('Impact', { direction, intensity, location });
    if (intensity === 'heavy' || intensity === 'launch') {
      this.emitEvent('CameraShake', { amount: intensity === 'launch' ? 14 : 8 });
    }
  }

  // Frame Update (60 FPS)
  update(dt, arena) {
    this.animTime += dt;
    this.upperBodyTime += dt;
    this.lowerBodyTime += dt;
    
    // Smooth Animation Blending
    if (this.blendWeight < 1.0) {
      this.blendWeight = Math.min(1.0, this.blendWeight + this.blendSpeed * dt);
      if (this.blendWeight >= 1.0) {
        this.currentAnim = this.targetAnim;
      }
    }

    // Update Foot IK Grounding (Spec 146)
    this.updateFootIK(arena);

    // Update Directional Hit Reaction Flinch
    if (this.hitReaction.active) {
      this.hitReaction.timer += dt;
      if (this.hitReaction.timer >= this.hitReaction.duration) {
        this.hitReaction.active = false;
        this.hitReaction.flinchAngle = 0;
      } else {
        // Smooth return from flinch
        const t = this.hitReaction.timer / this.hitReaction.duration;
        this.hitReaction.flinchAngle *= (1.0 - t * 0.15);
      }
    }

    // Process Animation Events based on fighter attack frame
    this.processAttackAnimationEvents();
  }

  // Procedural Foot IK / Grounding (Spec 146)
  updateFootIK(arena) {
    const groundLevel = (arena && arena.groundY) ? arena.groundY : this.fighter.groundY;
    this.footIK.floorY = groundLevel;

    if (this.fighter.isGrounded) {
      // Pin feet directly to arena floor, adjust pelvis based on crouching/stances
      const targetPelvis = this.fighter.isCrouching ? 22 : (this.hitReaction.active && this.hitReaction.direction === 'ABOVE' ? 12 : 0);
      this.footIK.pelvisOffset += (targetPelvis - this.footIK.pelvisOffset) * 0.2;
      this.footIK.leftFootY = groundLevel;
      this.footIK.rightFootY = groundLevel;
    } else {
      // In air: legs tuck smoothly based on vertical velocity
      this.footIK.pelvisOffset = 0;
      const tuck = Math.max(-15, Math.min(15, this.fighter.vy * 0.8));
      this.footIK.leftFootY = this.fighter.y + 100 + tuck;
      this.footIK.rightFootY = this.fighter.y + 96 - tuck * 0.5;
    }
  }

  // Animation Events Dispatcher (Spec 144)
  processAttackAnimationEvents() {
    if (this.fighter.state !== 'ATTACK' || !this.fighter.currentAttack) {
      if (this.isTrailActive) {
        this.isTrailActive = false;
        this.emitEvent('WeaponTrailStop');
      }
      return;
    }

    const atk = this.fighter.currentAttack;
    const frame = this.fighter.attackFrame;

    // 1. AttackStart Event
    if (frame === 1 && !this.dispatchedEvents.has('AttackStart')) {
      this.emitEvent('AttackStart', { attack: atk.id });
      this.dispatchedEvents.add('AttackStart');
    }

    // 2. WeaponTrailStart & HitboxEnable Events
    if (frame === atk.startup && !this.dispatchedEvents.has('HitboxEnable')) {
      this.isTrailActive = true;
      this.emitEvent('HitboxEnable', { attack: atk.id });
      this.emitEvent('WeaponTrailStart', { attack: atk.id });
      this.dispatchedEvents.add('HitboxEnable');
      this.dispatchedEvents.add('WeaponTrailStart');
    }

    // 3. HitboxDisable & WeaponTrailStop Events
    if (frame === (atk.startup + atk.active) && !this.dispatchedEvents.has('HitboxDisable')) {
      this.isTrailActive = false;
      this.emitEvent('HitboxDisable', { attack: atk.id });
      this.emitEvent('WeaponTrailStop', { attack: atk.id });
      this.dispatchedEvents.add('HitboxDisable');
      this.dispatchedEvents.add('WeaponTrailStop');
    }

    // 4. ComboWindow Event
    if (frame === atk.cancelWindow && !this.dispatchedEvents.has('ComboWindow')) {
      this.emitEvent('ComboWindow', { attack: atk.id });
      this.dispatchedEvents.add('ComboWindow');
    }

    // 5. AttackEnd Event
    if (frame >= (atk.startup + atk.active + atk.recovery) && !this.dispatchedEvents.has('AttackEnd')) {
      this.emitEvent('AttackEnd', { attack: atk.id });
      this.dispatchedEvents.add('AttackEnd');
    }
  }

  emitEvent(eventName, payload = {}) {
    window.eventBus.emit(`AnimEvent:${eventName}`, {
      fighter: this.fighter,
      ...payload
    });
  }

  // Calculate procedural skeletal bone angles for drawing
  calculatePose() {
    const f = this.fighter;
    const isAttacking = f.state === 'ATTACK' && f.currentAttack;
    const atk = isAttacking ? f.currentAttack : null;
    const progress = isAttacking ? (f.attackFrame / Math.max(1, atk.startup + atk.active + atk.recovery)) : 0;

    let torsoAngle = 0;
    let headAngle = 0;
    let leadArmAngle = 0.5;
    let rearArmAngle = -0.3;
    let leadLegAngle = 0.2;
    let rearLegAngle = -0.2;

    // Movement and Stance Blending
    if (f.state === 'IDLE') {
      const breath = Math.sin(this.animTime * 3.5) * 0.04;
      torsoAngle = breath;
      headAngle = -breath * 0.5;
      leadArmAngle = 0.4 + breath;
      rearArmAngle = -0.3 - breath;
    } else if (f.state === 'WALK') {
      const stride = Math.sin(this.animTime * 9.0);
      leadLegAngle = stride * 0.55;
      rearLegAngle = -stride * 0.55;
      leadArmAngle = -stride * 0.4;
      rearArmAngle = stride * 0.4;
      torsoAngle = 0.08 * f.facing;
    } else if (f.state === 'BLOCK') {
      torsoAngle = -0.15;
      leadArmAngle = -1.2;
      rearArmAngle = -0.9;
      headAngle = 0.1;
    } else if (f.state === 'DODGE') {
      torsoAngle = 0.65;
      leadLegAngle = 0.8;
      rearLegAngle = -0.7;
    } else if (f.state === 'HIT_STUN' || this.hitReaction.active) {
      torsoAngle = -this.hitReaction.flinchAngle;
      headAngle = -this.hitReaction.flinchAngle * 1.4;
      leadArmAngle = 0.8;
      rearArmAngle = -0.6;
    } else if (f.state === 'KNOCKED_DOWN') {
      torsoAngle = 1.45;
      headAngle = 0.2;
      leadLegAngle = 0.3;
      rearLegAngle = 0.4;
    }

    // Specific Attack Poses
    if (isAttacking) {
      if (atk.type === 'light') {
        const jabPhase = Math.sin(progress * Math.PI);
        leadArmAngle = -1.4 * jabPhase;
        torsoAngle = 0.15 * jabPhase;
      } else if (atk.type === 'kick') {
        const kickPhase = Math.sin(progress * Math.PI);
        leadLegAngle = -1.6 * kickPhase;
        torsoAngle = -0.35 * kickPhase;
      } else if (atk.type === 'heavy' || atk.type === 'special' || atk.type === 'ultimate') {
        const swingPhase = Math.sin(progress * Math.PI);
        leadArmAngle = (-2.2 + swingPhase * 3.4);
        torsoAngle = 0.35 * swingPhase;
      }
    }

    return {
      torsoAngle,
      headAngle,
      leadArmAngle,
      rearArmAngle,
      leadLegAngle,
      rearLegAngle,
      pelvisOffset: this.footIK.pelvisOffset
    };
  }
}
const _animRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_animRoot.AnimationEngine = AnimationEngine;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationEngine;
}
