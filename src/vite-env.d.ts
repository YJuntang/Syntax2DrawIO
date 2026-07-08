/// <reference types="vite/client" />

declare module '*?worker' {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

declare global {
  let MonacoEnvironment:
    | {
        getWorker?: (_moduleId: unknown, label: string) => Worker;
      }
    | undefined;
}

export {};
