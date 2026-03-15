import * as pty from "node-pty";
import os from "os";

export interface PtyCreateOptions {
  cwd: string;
  shell?: string;
  args?: string[];
}

export class PtyManager {
  private instances = new Map<number, pty.IPty>();
  private nextId = 1;

  create(options: PtyCreateOptions): number {
    const defaultShell =
      options.shell ??
      (os.platform() === "win32"
        ? "powershell.exe"
        : (process.env.SHELL ?? "/bin/zsh"));

    const ptyProcess = pty.spawn(defaultShell, options.args ?? [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: options.cwd,
      env: process.env as Record<string, string>,
    });

    const id = this.nextId++;
    this.instances.set(id, ptyProcess);
    return id;
  }

  getPid(id: number): number | undefined {
    return this.instances.get(id)?.pid;
  }

  write(id: number, data: string) {
    this.instances.get(id)?.write(data);
  }

  resize(id: number, cols: number, rows: number) {
    this.instances.get(id)?.resize(cols, rows);
  }

  onData(id: number, callback: (data: string) => void) {
    this.instances.get(id)?.onData(callback);
  }

  onExit(id: number, callback: (exitCode: number) => void) {
    this.instances.get(id)?.onExit(({ exitCode }) => callback(exitCode));
  }

  destroy(id: number) {
    const instance = this.instances.get(id);
    if (instance) {
      instance.kill();
      this.instances.delete(id);
    }
  }

  destroyAll() {
    for (const [id] of this.instances) {
      this.destroy(id);
    }
  }
}
