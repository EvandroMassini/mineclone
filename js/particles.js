// ============================================================
// Fase 6: partículas de quebra de bloco
// Cubinhos na cor do bloco, com velocidade, gravidade, rotação
// e fade-out. Pool com teto (recicla as mais antigas).
// ============================================================
import * as THREE from "three";

const MAX = 240; // teto de partículas vivas (performance)
const geo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
const GRAVITY = 14; // m/s²

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  /** Gera uma explosão de partículas em (x, y, z) na cor `color`. */
  burst(x, y, z, color, count = 16) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= MAX) {
        // recicla a partícula mais antiga
        const old = this.items.shift();
        this.scene.remove(old.mesh);
        old.mesh.material.dispose();
      }
      const mat = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.7,
        y + (Math.random() - 0.5) * 0.7,
        z + (Math.random() - 0.5) * 0.7,
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        1.8 + Math.random() * 3.2,
        (Math.random() - 0.5) * 4.5,
      );
      this.items.push({ mesh, vel, life: 0.65 + Math.random() * 0.5 });
      this.scene.add(mesh);
    }
  }

  /** Avança a física e remove as partículas expiradas. */
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += 5 * dt;
      p.mesh.rotation.z += 3.5 * dt;
      // fade-out nos últimos 30% da vida
      if (p.life < 0.3) p.mesh.material.opacity = Math.max(0, p.life / 0.3);
      p.mesh.scale.setScalar(Math.max(0.05, Math.min(1, p.life * 1.6)));
    }
  }

  get count() {
    return this.items.length;
  }
}
