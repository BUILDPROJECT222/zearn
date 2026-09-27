// Harus di-import paling awal: @solana/spl-token memakai Buffer global saat modul dimuat.
import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
