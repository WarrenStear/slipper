import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PhysicsSnapshotBody, PhysicsWorkerInMessage, PhysicsWorkerOutMessage } from "../workers/physicsWorker.types";
import { useWorldStore } from "../stores/useWorldStore";

type BodyTarget = THREE.Object3D;

export function usePhysicsWorker() {
  const workerRef = useRef<Worker | null>(null);
  const targetsRef = useRef(new Map<string, BodyTarget>());
  const setPlayerPosition = useWorldStore((state) => state.setPlayerPosition);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/physicsWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.postMessage({ type: "INIT", gravity: [0, -9.81, 0], fixedStep: 1 / 60 } satisfies PhysicsWorkerInMessage);

    worker.onmessage = (event: MessageEvent<PhysicsWorkerOutMessage>) => {
      const message = event.data;

      if (message.type === "ERROR") {
        console.warn("[PhysicsWorker]", message.message);
        return;
      }

      if (message.type !== "SNAPSHOT") return;

      for (const body of message.bodies) {
        applySnapshotBody(body, targetsRef.current.get(body.id));
      }

      if (message.playerPosition) setPlayerPosition(message.playerPosition);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      targetsRef.current.clear();
    };
  }, [setPlayerPosition]);

  return useMemo(
    () => ({
      post(message: PhysicsWorkerInMessage) {
        workerRef.current?.postMessage(message);
      },
      registerTarget(id: string, object: BodyTarget | null) {
        if (!object) {
          targetsRef.current.delete(id);
          return;
        }
        targetsRef.current.set(id, object);
      },
    }),
    [],
  );
}

function applySnapshotBody(body: PhysicsSnapshotBody, target?: BodyTarget) {
  if (!target) return;
  target.position.set(body.position[0], body.position[1], body.position[2]);
  target.quaternion.set(body.rotation[0], body.rotation[1], body.rotation[2], body.rotation[3]);
}
