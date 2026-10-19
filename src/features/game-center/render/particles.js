/**
 * Partículas con reserva fija (pool): no se crean ni destruyen objetos durante
 * la partida, solo se reutilizan. Si se agota la reserva, la partícula nueva
 * sustituye a la más vieja, así que el coste por fotograma nunca crece.
 *
 * Cada partícula: x, y, vx, vy, life (1→0), decay (por segundo), size, spin,
 * rot, gravity, drag, color, kind (lo interpreta el dibujo de cada juego).
 */
export function createParticles(capacity = 120) {
  const pool = Array.from({ length: capacity }, () => ({ alive: false }));
  let cursor = 0;

  return {
    capacity,
    emit(props) {
      let slot = null;
      for (let i = 0; i < capacity; i += 1) {
        const p = pool[(cursor + i) % capacity];
        if (!p.alive) {
          slot = p;
          cursor = (cursor + i + 1) % capacity;
          break;
        }
      }
      if (!slot) {
        slot = pool[cursor];
        cursor = (cursor + 1) % capacity;
      }
      slot.alive = true;
      slot.x = 0;
      slot.y = 0;
      slot.vx = 0;
      slot.vy = 0;
      slot.life = 1;
      slot.decay = 1;
      slot.size = 4;
      slot.spin = 0;
      slot.rot = 0;
      slot.gravity = 0;
      slot.drag = 0;
      slot.color = '#fff';
      slot.kind = 'dot';
      Object.assign(slot, props);
      return slot;
    },
    /** Avanza la simulación y llama a draw(p) para cada partícula viva. */
    update(dt, draw) {
      for (let i = 0; i < capacity; i += 1) {
        const p = pool[i];
        if (!p.alive) continue;
        p.life -= dt * p.decay;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        p.vy += p.gravity * dt;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        draw?.(p);
      }
    },
    /** Dibuja sin avanzar (redibujo en pausa). */
    each(draw) {
      for (let i = 0; i < capacity; i += 1) if (pool[i].alive) draw(pool[i]);
    },
    clear() {
      for (const p of pool) p.alive = false;
    },
    get count() {
      let n = 0;
      for (const p of pool) if (p.alive) n += 1;
      return n;
    },
  };
}
