export type Vector3Tuple = [number, number, number];
export type QuaternionTuple = [number, number, number, number];

export type PhysicsBodyKind = "player" | "dynamic" | "kinematic" | "static";

export type AddBodyMessage = {
  type: "ADD_BODY";
  id: string;
  kind: PhysicsBodyKind;
  position: Vector3Tuple;
  rotation?: QuaternionTuple;
  collider:
    | { type: "cuboid"; halfExtents: Vector3Tuple }
    | { type: "ball"; radius: number }
    | { type: "capsule"; halfHeight: number; radius: number };
  mass?: number;
};

export type SetPlayerInputMessage = {
  type: "SET_PLAYER_INPUT";
  move: Vector3Tuple;
  cameraYaw: number;
  speed: number;
  deltaHint?: number;
};

export type TeleportBodyMessage = {
  type: "TELEPORT_BODY";
  id: string;
  position: Vector3Tuple;
  rotation?: QuaternionTuple;
};

export type RemoveBodyMessage = {
  type: "REMOVE_BODY";
  id: string;
};

export type InitPhysicsMessage = {
  type: "INIT";
  gravity?: Vector3Tuple;
  fixedStep?: number;
};

export type PhysicsWorkerInMessage =
  | InitPhysicsMessage
  | AddBodyMessage
  | SetPlayerInputMessage
  | TeleportBodyMessage
  | RemoveBodyMessage;

export type PhysicsSnapshotBody = {
  id: string;
  position: Vector3Tuple;
  rotation: QuaternionTuple;
};

export type PhysicsWorkerOutMessage =
  | { type: "READY" }
  | { type: "SNAPSHOT"; bodies: PhysicsSnapshotBody[]; playerPosition?: Vector3Tuple }
  | { type: "ERROR"; message: string };
