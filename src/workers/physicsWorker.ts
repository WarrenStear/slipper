/// <reference lib="webworker" />

import RAPIER from "@dimforge/rapier3d-compat";
import type {
  AddBodyMessage,
  PhysicsSnapshotBody,
  PhysicsWorkerInMessage,
  SetPlayerInputMessage,
  Vector3Tuple,
} from "./physicsWorker.types";

let world: RAPIER.World | null = null;
let fixedStep = 1 / 60;
let timer: number | null = null;

const bodies = new Map<string, RAPIER.RigidBody>();
const colliders = new Map<string, RAPIER.Collider>();
let playerId: string | null = null;

let playerInput: SetPlayerInputMessage = {
  type: "SET_PLAYER_INPUT",
  move: [0, 0, 0],
  cameraYaw: 0,
  speed: 5,
};

function postError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ type: "ERROR", message });
}

function createCollider(desc: AddBodyMessage["collider"]) {
  if (desc.type === "cuboid") {
    return RAPIER.ColliderDesc.cuboid(desc.halfExtents[0], desc.halfExtents[1], desc.halfExtents[2]);
  }

  if (desc.type === "ball") {
    return RAPIER.ColliderDesc.ball(desc.radius);
  }

  return RAPIER.ColliderDesc.capsule(desc.halfHeight, desc.radius);
}

function createBody(message: AddBodyMessage) {
  if (!world) return;

  const bodyDesc =
    message.kind === "static"
      ? RAPIER.RigidBodyDesc.fixed()
      : message.kind === "kinematic"
        ? RAPIER.RigidBodyDesc.kinematicPositionBased()
        : RAPIER.RigidBodyDesc.dynamic();

  bodyDesc.setTranslation(message.position[0], message.position[1], message.position[2]);

  if (message.rotation) {
    bodyDesc.setRotation({
      x: message.rotation[0],
      y: message.rotation[1],
      z: message.rotation[2],
      w: message.rotation[3],
    });
  }

  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = createCollider(message.collider);

  if (typeof message.mass === "number") colliderDesc.setMass(message.mass);

  const collider = world.createCollider(colliderDesc, body);

  bodies.set(message.id, body);
  colliders.set(message.id, collider);

  if (message.kind === "player") {
    playerId = message.id;
    body.setEnabledRotations(false, false, false, true);
  }
}

function updatePlayerVelocity() {
  if (!playerId) return;

  const player = bodies.get(playerId);
  if (!player) return;

  const [x, , z] = playerInput.move;
  const length = Math.hypot(x, z);

  if (length < 0.001) {
    player.setLinvel({ x: 0, y: player.linvel().y, z: 0 }, true);
    return;
  }

  const yaw = playerInput.cameraYaw;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const nx = x / length;
  const nz = z / length;
  const worldX = nx * cos - nz * sin;
  const worldZ = nx * sin + nz * cos;

  player.setLinvel(
    {
      x: worldX * playerInput.speed,
      y: player.linvel().y,
      z: worldZ * playerInput.speed,
    },
    true,
  );
}

function stepWorld() {
  if (!world) return;

  updatePlayerVelocity();
  world.step();

  const snapshot: PhysicsSnapshotBody[] = [];

  bodies.forEach((body, id) => {
    if (body.isFixed()) return;

    const t = body.translation();
    const r = body.rotation();

    snapshot.push({
      id,
      position: [t.x, t.y, t.z],
      rotation: [r.x, r.y, r.z, r.w],
    });
  });

  const player = playerId ? bodies.get(playerId) : null;
  const playerTranslation = player?.translation();

  self.postMessage({
    type: "SNAPSHOT",
    bodies: snapshot,
    playerPosition: playerTranslation ? [playerTranslation.x, playerTranslation.y, playerTranslation.z] : undefined,
  });
}

async function init(gravity: Vector3Tuple = [0, -9.81, 0], step = 1 / 60) {
  await RAPIER.init();

  fixedStep = step;
  world = new RAPIER.World({ x: gravity[0], y: gravity[1], z: gravity[2] });

  if (timer !== null) clearInterval(timer);

  timer = self.setInterval(stepWorld, fixedStep * 1000);
  self.postMessage({ type: "READY" });
}

self.onmessage = (event: MessageEvent<PhysicsWorkerInMessage>) => {
  try {
    const message = event.data;

    if (message.type === "INIT") {
      void init(message.gravity, message.fixedStep);
      return;
    }

    if (!world) return;

    if (message.type === "ADD_BODY") {
      createBody(message);
      return;
    }

    if (message.type === "SET_PLAYER_INPUT") {
      playerInput = message;
      return;
    }

    if (message.type === "TELEPORT_BODY") {
      const body = bodies.get(message.id);
      if (!body) return;

      body.setTranslation({ x: message.position[0], y: message.position[1], z: message.position[2] }, true);

      if (message.rotation) {
        body.setRotation(
          {
            x: message.rotation[0],
            y: message.rotation[1],
            z: message.rotation[2],
            w: message.rotation[3],
          },
          true,
        );
      }

      return;
    }

    if (message.type === "REMOVE_BODY") {
      const body = bodies.get(message.id);
      if (body) world.removeRigidBody(body);
      bodies.delete(message.id);
      colliders.delete(message.id);
    }
  } catch (error) {
    postError(error);
  }
};
