import fs from 'fs/promises';
import path from 'path';
import { MemoryAdapter, Message } from './BaseAdapter.js';
import { AdapterError } from '../config/errors.js';

export default class FileMemoryAdapter implements MemoryAdapter {
    private readonly basePath: string;

    constructor(options: { path?: string } = {}) {
        this.basePath = options.path || path.resolve(process.cwd(), 'data/sessions');
    }

    private getSessionPath(sessionId: string): string {
        const safeSessionId = path.basename(sessionId).replace(/[^a-z0-9_.-]/gi, '_');
        return path.join(this.basePath, `${safeSessionId}.json`);
    }

    async getHistory(sessionId: string): Promise<Message[]> {
        const filePath = this.getSessionPath(sessionId);
        try {
            await fs.access(filePath);
            const rawData = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(rawData);
        } catch {
            return [];
        }
    }
    
    async addMessage(sessionId: string, message: Message): Promise<void> {
        const history = await this.getHistory(sessionId);
        history.push(message);
        await this.saveHistory(sessionId, history);
    }

    private async saveHistory(sessionId: string, history: Message[]): Promise<void> {
        const filePath = this.getSessionPath(sessionId);
        try {
            await fs.mkdir(this.basePath, { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(history, null, 2));
        } catch (error) {
            throw new AdapterError(`Gagal menyimpan riwayat untuk sesi ${sessionId}`);
        }
    }

    async clearHistory(sessionId: string): Promise<boolean> {
        const filePath = this.getSessionPath(sessionId);
        try {
            await fs.unlink(filePath);
            return true;
        } catch {
            return false;
        }
    }
}