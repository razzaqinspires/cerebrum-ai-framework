#  Cerebrum AI Framework 🧠

![NPM Version](https://img.shields.io/npm/v/cerebrum-ai-framework?color=CB3837&style=for-the-badge)
![NPM Downloads](https://img.shields.io/npm/dw/cerebrum-ai-framework?color=00A8E8&style=for-the-badge)
![License](https://img.shields.io/npm/l/cerebrum-ai-framework?color=lightgrey&style=for-the-badge)

**Cerebrum** adalah sebuah framework AI yang tangguh, dapat diperluas, dan modern untuk Node.js & TypeScript. Didesain untuk mengatasi masalah umum saat berinteraksi dengan API LLM, seperti kegagalan layanan, manajemen kunci API, kontrol biaya, dan kebutuhan akan fungsionalitas yang lebih dari sekadar chat.

Framework ini mengubah interaksi API yang kompleks menjadi sebuah pengalaman yang mulus, memungkinkan developer untuk fokus membangun aplikasi AI yang cerdas, bukan mengelola infrastruktur yang rapuh.

## ✨ Fitur Utama

* **🧠 Multi-Provider & Fallback Cerdas:** Secara otomatis beralih ke provider AI berikutnya (misalnya dari Gemini ke Groq) jika terjadi kegagalan, rate limit, atau kunci API habis.
* **⚡ Streaming Real-time:** Dapatkan respons dari AI kata per kata, memberikan pengalaman pengguna yang sangat responsif seperti pada aplikasi chat modern.
* **🛠️ Dukungan Tools (Function Calling):** Beri AI Anda kemampuan untuk "bertindak"—menjalankan fungsi kustom Anda untuk mengambil data dari API eksternal, database, atau sistem lainnya.
* **📚 Manajemen Konteks Otomatis:** Secara cerdas memangkas riwayat percakapan yang panjang untuk menghindari error batas token dan mengoptimalkan biaya API.
* **💽 Caching Cerdas:** Secara otomatis menyimpan respons untuk permintaan yang sama, mengurangi latensi dan menghemat biaya secara drastis.
* **🔌 Arsitektur Pluggable:** Ganti komponen inti seperti sistem memori atau caching dengan implementasi Anda sendiri (misalnya, Redis, MongoDB) menggunakan pola Adapter yang bersih.
* **⚙️ Sistem Plugin & Middleware:** "Suntikkan" logika kustom Anda sendiri ke dalam siklus hidup permintaan/respons untuk keperluan logging, analitik, moderasi, dan lainnya.
* **🔐 Keamanan & Konfigurasi Profesional:** Validasi konfigurasi yang ketat menggunakan Zod dan desain yang tidak memaksa penggunaan `.env`, memberikan developer kontrol penuh.

## Diagram Alur Kerja (Algoritma)

Berikut adalah gambaran tingkat tinggi tentang bagaimana Cerebrum memproses sebuah permintaan, menunjukkan kecerdasan di balik layar.

```mermaid
graph TD
    A[Pengguna Mengirim Input] --> B{Cerebrum.chatStream()};
    B --> C{Cache Check};
    C -- CACHE HIT --> D[Stream Respons dari Cache];
    C -- CACHE MISS --> E[Responder Mulai Bekerja];
    E --> F{Provider #1 (misal: Gemini)};
    F -- Gagal/Limit --> G{Provider #2 (misal: Groq)};
    F -- Sukses --> H[Panggil API LLM];
    G -- Sukses --> H;
    H --> I{AI Perlu Tool?};
    I -- YA --> J[Jalankan Fungsi Lokal];
    J --> K[Kirim Hasil Tool ke AI];
    K --> H;
    I -- TIDAK --> L[Stream Respons Teks dari AI];
    L --> M{Simpan ke Cache & Memori};
    D --> Z[Selesai];
    M --> Z;
```

## 🚀 Instalasi

```bash
npm install cerebrum-ai-framework
```

## 🏁 Penggunaan Cepat (Quick Start)

Buat file `index.ts` dan jalankan dengan `tsx index.ts`.

```typescript
// index.ts
import { Cerebrum } from 'cerebrum-ai-framework';

// 1. Definisikan konfigurasi Anda
const appConfig = {
    apiKeys: { 
        groq: ["gsk_..."], // Ganti dengan kunci API Groq Anda
    },
    providerStrategy: ['groq'],
    modelDefaults: { 
        groq: 'llama3-8b-8192',
    },
};

async function main() {
    // 2. Inisialisasi Cerebrum
    const cerebrum = new Cerebrum(appConfig);
    await cerebrum.bootstrap();

    // 3. Mulai percakapan!
    const sessionId = 'quick-start-123';
    const prompt = "Halo, dunia!";

    console.log(`Anda: ${prompt}`);
    process.stdout.write('AI: ');

    for await (const event of cerebrum.chatStream(sessionId, prompt)) {
        if (event.type === 'chunk') {
            process.stdout.write(event.content);
        }
    }
    console.log();
    cerebrum.shutdown();
}

main();
```

---

## ⚙️ Konfigurasi Lengkap (`CerebrumConfig`)
Ini adalah objek utama yang Anda berikan ke `Cerebrum` untuk mengatur segalanya.

* `apiKeys: Record<string, string[]>`: Objek berisi kunci API Anda. *Key* adalah nama provider (misal: `"groq"`), dan *value* adalah array berisi satu atau lebih string kunci API.
* `providerStrategy: string[]`: Array berisi nama-nama provider, menentukan urutan prioritas fallback. Contoh: `['gemini', 'groq', 'openai']`.
* `modelDefaults: Record<string, string>`: Memetakan nama provider ke model default yang akan digunakan. Contoh: `{ groq: 'llama3-70b-8192' }`.
* `prompting?: { systemPrompt?: string }`: *(Opsional)* Tempat untuk mendefinisikan `systemPrompt` default untuk semua permintaan.
* `contextManagement?: { strategy, ... }`: *(Opsional)* Mengatur cara framework memangkas riwayat percakapan.
    * `strategy: 'slidingWindow', maxMessages: number`: Hanya menyimpan N pesan terakhir. Cepat dan sederhana.
    * `strategy: 'tokenLimit', maxTokens: number`: Memastikan total token riwayat tidak melebihi batas. Lebih presisi untuk kontrol biaya.
* `caching?: { enabled: boolean, ttl: number }`: *(Opsional)* Mengaktifkan caching. `ttl` adalah masa berlaku cache dalam detik.
* `tools?: ToolDefinition[]`: *(Opsional)* Array berisi definisi dari semua *tools* yang bisa digunakan oleh AI.

---

## 💡 Pola Penggunaan & Skenario Lanjutan

Cerebrum dirancang untuk fleksibel. Berikut adalah beberapa pola dan saran untuk kasus penggunaan yang berbeda.

### Skenario 1: Chatbot Layanan Pelanggan (Fokus pada Konteks & Tools)
* **Kebutuhan:** Bot harus mengingat percakapan panjang dengan pelanggan dan bisa mengambil data spesifik (misal: status pesanan).
* **Solusi Cerebrum:** Fokus pada `contextManagement` dan `tools`.

**Konfigurasi yang Direkomendasikan:**
Gunakan strategi `tokenLimit` untuk memastikan riwayat yang sangat panjang pun tetap bisa dikelola tanpa error, dan daftarkan `tool` untuk mengambil data.

```typescript
import { z } from 'zod';

const appConfig = {
    // ... apiKeys, providerStrategy, dll.
    contextManagement: {
        strategy: 'tokenLimit',
        maxTokens: 10000, // Izinkan konteks yang cukup panjang untuk tiket support
    },
    tools: [{
        name: 'getOrderStatus',
        description: 'Mendapatkan status pesanan pelanggan berdasarkan ID pesanan.',
        parameters: z.object({ orderId: z.string() }),
    }]
};
```

### Skenario 2: Generator Konten/Artikel (Fokus pada Caching & Prompting)
* **Kebutuhan:** Sebuah alat internal untuk membuat draf artikel berdasarkan topik. Seringkali, permintaan yang sama diulang. Latensi bukan masalah utama, tetapi biaya API harus ditekan.
* **Solusi Cerebrum:** Fokus pada `caching` dan `prompting` dinamis.

**Konfigurasi dan Penggunaan:**
Aktifkan `caching` dengan TTL (masa berlaku) yang cukup lama. Gunakan `options.systemPrompt` saat memanggil `.chatStream()` untuk memberikan instruksi yang sangat spesifik.

```typescript
const appConfig = {
    // ... apiKeys, dll.
    caching: {
        enabled: true,
        ttl: 3600, // Simpan hasil yang sama selama 1 jam
    },
};

// Penggunaan di aplikasi
async function generateArticle(topic: string) {
    const prompt = `Buat draf artikel 500 kata tentang topik: ${topic}`;
    const options = {
        systemPrompt: "Anda adalah penulis konten profesional yang ahli dalam SEO. Tulislah dengan gaya yang informatif dan menarik."
    };

    for await (const event of cerebrum.chatStream('content-generator', prompt, options)) {
        // ...
    }
}
```

---

## 📚 API Referensi & Konsep Inti

Bagian ini ditujukan bagi developer yang ingin memahami arsitektur "Cerebrum" lebih dalam.

### `Cerebrum` (Kelas Utama)
Titik masuk utama dari framework. Semua interaksi dilakukan melalui instance dari kelas ini.

* **`new Cerebrum(config, toolImplementations, plugins, corePromptConfig)`**
    * `config: CerebrumConfig`: **(Wajib)** Objek konfigurasi utama.
    * `toolImplementations?: Record<string, ToolImplementation>`: *(Opsional)* Fungsi asli untuk setiap `tool` yang didefinisikan di `config`.
    * `plugins?: Plugin[]`: *(Opsional)* Array berisi plugin yang ingin diaktifkan.
    * `corePromptConfig?: CorePromptConfig`: *(Opsional)* Konfigurasi untuk "Prompt Inti" AI, termasuk password.

* **`.bootstrap(): Promise<void>`**
    Wajib dipanggil sekali setelah inisialisasi untuk memuat state dan menjalankan layanan latar belakang.

* **`.chatStream(sessionId, userInput, options): AsyncGenerator<ChatStreamEvent>`**
    Metode utama untuk memulai percakapan. Menggunakan `for await...of` untuk menerima event (`chunk`, `tool_call`, dll) secara real-time.

### Tipe & Interface yang Dapat Diimpor
Anda dapat mengimpor tipe-tipe ini untuk memastikan kode Anda *type-safe*.

* `ToolDefinition`: Objek untuk mendefinisikan sebuah tool (`name`, `description`, `parameters` menggunakan Zod).
* `Plugin`: Objek yang berisi satu atau lebih metode *hook* (`onPreChat`, `onPreRequest`, `onChatComplete`, dll) untuk memperluas fungsionalitas.
* `ChatStreamEvent`: Objek yang di-`yield` oleh `.chatStream()`. Memiliki `type` dan `content`.
* `CorePromptConfig`: Objek `{ content: string, password?: string }` untuk mengatur identitas dasar AI.
* `ChatOptions`: Objek `{ systemPrompt?: string }` untuk dikirim per permintaan.

### Penanganan Error
Cerebrum melempar kelas error kustom agar Anda bisa menangani kegagalan dengan spesifik.

```typescript
import { Cerebrum, AllProvidersFailedError, ConfigError } from 'cerebrum-ai-framework';

try {
    const cerebrum = new Cerebrum(...);
    await cerebrum.chatStream(...);
} catch (error) {
    if (error instanceof ConfigError) {
        console.error("Konfigurasi salah:", error.message);
    } else if (error instanceof AllProvidersFailedError) {
        console.error("Layanan AI sedang sibuk, coba lagi nanti.");
        console.log("Penyebab terakhir:", error.lastError);
    }
}
```

## 🤝 Dukungan & Komunitas

Proyek ini dibuat dan dipelihara oleh **Razzaq.** Terhubunglah dengan saya!

* **⭐ Follow di GitHub:** [**razzaqinspires**](https://github.com/razzaqinspires)
* **📸 Ikuti di Instagram:** [**@ar.zzq**](https://www.instagram.com/ar.zzq)

Merasa framework ini bermanfaat? Punya ide atau ingin berkontribusi? Jangan ragu untuk membuat *issue* atau *pull request* di repository GitHub.

## ❤️ Dukung Proyek Ini

Jika Anda merasa Cerebrum membantu pekerjaan Anda dan ingin memberikan apresiasi, Anda bisa mendukung saya melalui Saweria. Setiap dukungan sangat berarti dan membantu saya untuk terus mengembangkan proyek open-source yang bermanfaat.

<a href="https://saweria.co/arzzq" target="_blank" rel="noopener noreferrer">
  <img src="https://user-images.githubusercontent.com/24271830/224734823-3883d6c5-ab74-4348-8442-5339f46bT098.png" alt="Dukung di Saweria" width="200">
</a>

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah **MIT License**.