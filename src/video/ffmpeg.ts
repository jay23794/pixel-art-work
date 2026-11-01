// Node side: encodes raw RGBA frames streamed to FFmpeg's stdin.
import { spawn } from 'node:child_process';

export interface EncodeOptions {
  /** Logical frame size (input). */
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** Output size; must be a whole-number multiple (nearest-neighbour upscale). */
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly out: string;
  readonly crf?: number;
  readonly ffmpegPath?: string;
}

export interface Encoder {
  /** Writes one frame (width × height × 4 bytes); resolves once FFmpeg has accepted it. */
  write(rgba: Buffer): Promise<void>;
  /** Closes the input and resolves when FFmpeg has finished writing the file. */
  finish(): Promise<void>;
  /** Stops FFmpeg (after a failure elsewhere). */
  abort(): void;
}

/** The FFmpeg arguments used for export. */
export function ffmpegArgs(o: EncodeOptions): string[] {
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${o.width}x${o.height}`, '-framerate', String(o.fps), '-i', 'pipe:0',
    // Crisp pixels; convert to BT.709 (and tag it) so players show the right colours.
    '-vf', `scale=${o.outputWidth}:${o.outputHeight}:flags=neighbor:out_color_matrix=bt709:out_range=tv,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv`,
    '-c:v', 'libx264', '-tune', 'animation', '-crf', String(o.crf ?? 16), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    o.out,
  ];
}

export function startEncoder(o: EncodeOptions): Encoder {
  const bin = o.ffmpegPath ?? 'ffmpeg';
  const frameBytes = o.width * o.height * 4;
  const proc = spawn(bin, ffmpegArgs(o), { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));

  let failure: Error | undefined;
  const exited = new Promise<void>((resolveExit, rejectExit) => {
    proc.on('error', (e: NodeJS.ErrnoException) => {
      failure = new Error(
        e.code === 'ENOENT' ? `FFmpeg not found ("${bin}"). Install it and make sure it is on your PATH (see README).` : `FFmpeg failed to start: ${e.message}`,
      );
      rejectExit(failure);
    });
    proc.on('close', (code, signal) => {
      if (code === 0) return resolveExit();
      failure ??= new Error(`FFmpeg exited with ${signal ? `signal ${signal}` : `code ${code}`}${stderr.trim() ? `:\n${stderr.trim()}` : ''}`);
      rejectExit(failure);
    });
  });
  exited.catch(() => {}); // surfaced through write()/finish()
  proc.stdin.on('error', () => {}); // EPIPE etc.: reported via the exit above

  return {
    write(rgba) {
      if (failure) return Promise.reject(failure);
      if (rgba.length !== frameBytes) return Promise.reject(new Error(`frame is ${rgba.length} bytes, expected ${frameBytes} (${o.width}×${o.height} RGBA)`));
      return new Promise((resolveWrite, rejectWrite) => {
        proc.stdin.write(rgba, (e) => (e ? rejectWrite(failure ?? e) : resolveWrite()));
      });
    },
    async finish() {
      if (failure) throw failure;
      proc.stdin.end();
      await exited;
    },
    abort() {
      proc.kill('SIGKILL');
    },
  };
}
