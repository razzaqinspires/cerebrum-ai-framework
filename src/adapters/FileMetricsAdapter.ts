/**
 * @file src/adapters/FileMetricsAdapter.ts
 * @description Implementasi default untuk menyimpan metrik performa ke file JSONL.
 */
import fs from 'fs/promises';
import path from 'path';
import { MetricsAdapter, PerformanceRecord } from './BaseAdapter.js';
import { AdapterError } from '../config/errors.js';

export class FileMetricsAdapter implements MetricsAdapter {
    private readonly filePath: string;

    constructor(options: { path?: string } = {}) {
        this.filePath = options.path || path.resolve(process.cwd(), 'data/performance_log.jsonl');
    }

    async log(record: PerformanceRecord): Promise<void> {
        const logLine = JSON.stringify(record) + '\n';
        try {
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            await fs.appendFile(this.filePath, logLine);
        } catch (error) {
            // Kita tidak ingin pencatatan log menghentikan aplikasi utama
            console.error(new AdapterError(`Gagal menulis metrik ke file: ${this.filePath}`));
        }
    }
}