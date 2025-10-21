#  Cerebrum AI Framework 🧠

![NPM Version](https://img.shields.io/npm/v/cerebrum-ai-framework?color=CB3837&style=for-the-badge)
![NPM Downloads](https://img.shields.io/npm/dw/cerebrum-ai-framework?color=00A8E8&style=for-the-badge)
![License](https://img.shields.io/npm/l/cerebrum-ai-framework?color=lightgrey&style=for-the-badge)

**Cerebrum** adalah sebuah framework AI yang tangguh, dapat diperluas, dan modern untuk Node.js & TypeScript. Didesain untuk mengatasi masalah umum saat berinteraksi dengan API LLM, seperti kegagalan layanan, manajemen kunci API, kontrol biaya, dan kebutuhan akan fungsionalitas yang lebih dari sekadar chat.

Framework ini mengubah interaksi API yang kompleks menjadi sebuah pengalaman yang mulus, memungkinkan developer untuk fokus membangun aplikasi AI yang cerdas, bukan mengelola infrastruktur yang rapuh.

---

## 🆕 Status & Roadmap Proyek

Tabel ini menunjukkan status implementasi dari fitur-fitur utama Cerebrum.

| Fitur | Status | Versi Tersedia |
| :--- | :--- | :--- |
| **Multi-Provider & Fallback Cerdas** | ✅ Selesai | `v1.0.0` |
| **Rotasi Kunci API Otomatis** | ✅ Selesai | `v1.0.0` |
| **Manajemen Konteks Otomatis** | ✅ Selesai | `v1.1.0` |
| **Streaming Respons Real-time** | ✅ Selesai | `v1.1.0` |
| **Dukungan Tools (Function Calling)** | ✅ Selesai | `v1.2.0` |
| **Caching Respons Cerdas** | ✅ Selesai | `v1.2.0` |
| **Sistem Plugin/Middleware** | ✅ Selesai | `v1.2.0` |
| **Provider Kustom oleh Pengguna** | ✅ Selesai | `v1.2.0` |
| **Dukungan Modul Ganda (ESM & CJS)** | ✅ Selesai | `v1.1.0` |
| **Logger & Error Handling Canggih** | ✅ Selesai | `v1.1.0` |
| **Self-Healing Fallback (AI Scraper)** | ⏳ Direncanakan | `v2.0.0` |

### Roadmap Masa Depan (Eksperimental)

* **⏳ Self-Healing Fallback:** Sebuah fitur ambisius di mana Cerebrum memiliki asisten AI internal yang dapat secara proaktif mencari provider AI gratis baru, menulis konfigurasinya sendiri, dan menggunakannya sebagai fallback terakhir jika semua provider utama gagal.
* **⏳ Komponen Logika Dinamis:** Kemampuan AI untuk membuat "tool" sederhana secara dinamis untuk tugas-tugas spesifik seperti perhitungan matematika atau pemformatan tanggal.

---

## ✨ Fitur Utama

* **🧠 Multi-Provider & Fallback Cerdas:** Secara otomatis beralih ke provider AI berikutnya jika terjadi kegagalan, rate limit, atau kunci API habis.
* **⚡ Streaming Real-time:** Dapatkan respons dari AI kata per kata, memberikan pengalaman pengguna yang sangat responsif seperti pada aplikasi chat modern.
* **🛠️ Dukungan Tools (Function Calling):** Beri AI Anda kemampuan untuk "bertindak"—menjalankan fungsi kustom Anda untuk berinteraksi dengan API eksternal atau database.
* **📚 Manajemen Konteks Otomatis:** Secara cerdas memangkas riwayat percakapan yang panjang untuk menghindari error batas token dan mengoptimalkan biaya API.
* **💽 Caching Cerdas:** Secara otomatis menyimpan respons untuk permintaan yang sama, mengurangi latensi dan menghemat biaya.
* **🔌 Arsitektur Pluggable:** Ganti komponen inti (memori, caching) dan tambahkan provider AI kustom Anda sendiri dengan mudah.
* **⚙️ Sistem Plugin & Middleware:** "Suntikkan" logika kustom pada berbagai tahap siklus hidup permintaan untuk analitik, moderasi, dll.
* **📦 Dukungan Modul Ganda:** Bekerja secara *out-of-the-box* baik dengan proyek **ES Modules (`import`)** maupun **CommonJS (`require`)**.

## Diagram Alur Kerja (Algoritma)

```mermaid
graph TD
    %%================ CORE FLOW ================
    A0([Input Pengguna]) -->|Prompt Masuk| B0{Cerebrum.chatStream Core};

    %% 1. PREPROCESSING
    B0 --> B1[Input Normalizer<br>(NLP Cleaner + Context Rebuilder)];
    B1 --> B2{Context Fusion Layer<br>(Memory Pool + Cache Integration)};

    %% 2. CACHE SYSTEM
    B2 -->|Cek| C1{Cache Quantum Check};
    C1 -- CACHE HIT --> D1[Stream dari HyperCache];
    C1 -- CACHE MISS --> E1[Multi-Responder Mesh];

    %% 3. RESPONDER MESH
    E1 --> F1[Provider #1<br>(Primary Cortex API)];
    E1 --> F2[Provider #2<br>(Backup Neural Node)];
    E1 --> F3[Provider #3<br>(Experimental Sandbox)];

    %% 4. PROVIDER ROUTING LOGIC
    F1 -->|Success| H1[Unified LLM Interface];
    F1 -->|Fail| F2;
    F2 -->|Fail| F3;
    F2 -->|Success| H1;
    F3 -->|Success| H1;
    F3 -->|Fail| X1([Fallback Emergency Core]);

    %% 5. AI CORE LOGIC
    H1 --> I1{Perlu Tool / Eksekusi Lokal?};
    I1 -- YA --> J1[Tool Orchestrator Hub];
    I1 -- TIDAK --> L1[AI Stream Generator];

    %% 6. TOOL EXECUTION
    J1 --> J2[Adaptive Tool Selector<br>(Local / Remote)];
    J2 --> J3{Tool Executor};
    J3 --> K1[Kirim Output ke AI Core];
    K1 --> H1;

    %% 7. TEXT STREAMING
    L1 --> M1[Thought Stream Synthesizer];
    M1 --> M2{Evaluasi & Refinement Pass};
    M2 -->|Revisi| L1;
    M2 -->|Final| N1[Stream ke Pengguna];

    %% 8. MEMORY + CACHE
    N1 --> M3[Cache & Memory Integrator];
    M3 --> M4[Long-Term Memory Store<br>(Semantic Vector + Emotional Layer)];
    D1 --> Z1([Selesai & Stream Final]);
    M4 --> Z1;

    %% 9. FEEDBACK LOOP (SELF-EVOLVING)
    Z1 --> FBL1{Feedback Analysis Engine};
    FBL1 --> FBL2[Quality Scoring<br>+ Hallucination Filter];
    FBL2 --> FBL3[Model Recalibration Unit];
    FBL3 --> B0; %% Self-Optimizing Loop

    %%================ STYLING ==================
    classDef core fill=#212b36,stroke=#00ffc6,stroke-width:2px,color=#e0fffa,font-weight:bold;
    classDef process fill=#1b1f22,stroke=#00b4ff,stroke-width:1.5px,color=#f0ffff;
    classDef decision fill=#111827,stroke=#ff7b00,stroke-width:2px,color=#fff3e6,font-weight:bold;
    classDef terminal fill=#002b36,stroke=#00ff88,stroke-width:3px,color=#aaffdd,font-weight:bold;

    class A0,Z1,X1 terminal;
    class B0,B1,B2,E1,F1,F2,F3,H1,J1,J2,J3,L1,M1,M3,M4 process;
    class C1,I1,M2,FBL1,FBL2,FBL3 decision;
```

## 🚀 Instalasi

```bash
npm install cerebrum-ai-framework
```

## 🏁 Penggunaan Cepat (Quick Start)

Cerebrum mendukung baik ES Modules maupun CommonJS. Pilih contoh yang sesuai dengan proyek Anda.

### ES Modules (`import`)
Gunakan ini di proyek TypeScript atau proyek JavaScript dengan `"type": "module"` di `package.json`.

```typescript
// index.ts atau index.mjs
import { Cerebrum } from 'cerebrum-ai-framework';

const config = {
    apiKeys: { groq: ["gsk_..."] }, // Ganti dengan kunci API Anda
    providerStrategy: ['groq'],
    modelDefaults: { groq: 'llama3-8b-8192' },
};

async function main() {
    const cerebrum = new Cerebrum(config);
    await cerebrum.bootstrap();

    console.log('Anda: Halo!');
    process.stdout.write('AI: ');
    for await (const event of cerebrum.chatStream('sesi-1', 'Halo!')) {
        if (event.type === 'chunk') process.stdout.write(event.content);
    }
    console.log();
    cerebrum.shutdown();
}

main();
```

### CommonJS (`require`)
Gunakan ini di proyek Node.js tradisional (tanpa `"type": "module"`).

```javascript
// index.js
const { Cerebrum } = require('cerebrum-ai-framework');

const config = {
    apiKeys: { groq: ["gsk_..."] }, // Ganti dengan kunci API Anda
    providerStrategy: ['groq'],
    modelDefaults: { groq: 'llama3-8b-8192' },
};

// Gunakan IIFE (Immediately Invoked Function Expression) untuk top-level await
(async () => {
    const cerebrum = new Cerebrum(config);
    await cerebrum.bootstrap();

    console.log('Anda: Halo!');
    process.stdout.write('AI: ');
    for await (const event of cerebrum.chatStream('sesi-2', 'Halo!')) {
        if (event.type === 'chunk') process.stdout.write(event.content);
    }
    console.log();
    cerebrum.shutdown();
})();
```

---

## ⚙️ Konfigurasi Lengkap (`CerebrumConfig`)
Ini adalah objek utama yang Anda berikan ke `Cerebrum` untuk mengatur segalanya.

* `apiKeys: Record<string, string[]>`: Objek berisi kunci API Anda. *Key* adalah nama provider (misal: `"groq"`), dan *value* adalah array berisi satu atau lebih string kunci API untuk rotasi otomatis.
* `providerStrategy: string[]`: Array yang menentukan urutan prioritas provider fallback.
* `modelDefaults: Record<string, string>`: Memetakan provider ke nama model default yang akan digunakan.
* `customProviders?: Record<string, ProviderConfig>`: *(Opsional)* Daftarkan provider AI kustom Anda di sini.
* `prompting?: { systemPrompt?: string }`: *(Opsional)* Definisikan `systemPrompt` default untuk semua permintaan.
* `contextManagement?: { strategy, ... }`: *(Opsional)* Atur cara framework memangkas riwayat percakapan (`slidingWindow` atau `tokenLimit`).
* `caching?: { enabled: boolean, ttl: number }`: *(Opsional)* Aktifkan caching respons. `ttl` dalam detik.
* `tools?: ToolDefinition[]`: *(Opsional)* Definisikan *tools* yang bisa digunakan oleh AI.

---

## ✨ Menambahkan Provider Kustom (Fitur Lanjutan)

Anda tidak terbatas pada provider bawaan. Daftarkan provider AI apa pun dengan 3 langkah: **Define, Register, Prioritize.**

### Contoh: Membuat dan Menggunakan "EchoAI"

#### 1. Define (Definisikan Logika Provider)
Di file konfigurasi Anda, buat sebuah objek yang sesuai dengan interface `ProviderConfig`.

```typescript
import { ProviderConfig, Message } from 'cerebrum-ai-framework';

const echoAIProvider: ProviderConfig = {
    getEndpoint: () => "local://echo",
    buildPayload: (history, modelName) => ({ history, modelName }),
    extractMessage: (requestPayload: { data: { history: Message[] } }) => {
        const lastUserMessage = requestPayload.data.history.filter(m => m.role === 'user').pop();
        return {
            role: 'assistant',
            content: `AI Gema merespons: "${lastUserMessage?.content}"`
        };
    }
};
```

#### 2. Register & 3. Prioritize
Masukkan definisi dan nama provider kustom Anda ke dalam konfigurasi utama.

```typescript
const appConfig = {
    apiKeys: { groq: ["gsk_..."] }, // EchoAI tidak perlu kunci
    providerStrategy: ['EchoAI', 'groq'], // Jadikan EchoAI prioritas utama!
    modelDefaults: { 
        groq: 'llama3-8b-8192',
        EchoAI: 'echo-v1',
    },
    customProviders: {
        EchoAI: echoAIProvider, // Daftarkan di sini
    }
};
```

---

## 💡 Pola Penggunaan & Skenario Lanjutan

* **Chatbot Layanan Pelanggan:** Gunakan `contextManagement: { strategy: 'tokenLimit' }` untuk mengelola tiket support yang panjang dan `tools` untuk mengambil data pesanan.
* **Generator Konten:** Aktifkan `caching: { enabled: true, ttl: 3600 }` untuk menghemat biaya pada topik yang sering diminta. Gunakan `options.systemPrompt` untuk mengarahkan gaya penulisan AI per artikel.
* **Bot Interaktif Real-time (Discord/Telegram):** Manfaatkan penuh loop `for await...of` pada `cerebrum.chatStream()` dan event `chunk` untuk menciptakan ilusi AI sedang "mengetik" dengan mengedit pesan secara bertahap.

---

## 📚 API Referensi & Konsep Inti

Bagian ini untuk developer yang ingin memahami arsitektur Cerebrum lebih dalam.

### `Cerebrum` (Kelas Utama)
Titik masuk utama dari framework.

* **`new Cerebrum(config, toolImplementations?, plugins?, corePromptConfig?)`**: Konstruktor untuk membuat instance baru dengan konfigurasi eksplisit.
* **`.bootstrap(): Promise<void>`**: Wajib dipanggil sekali untuk memuat state dan menjalankan layanan latar belakang.
* **`.chatStream(sessionId, userInput, options?): AsyncGenerator<ChatStreamEvent>`**: Metode utama untuk memulai percakapan, mengembalikan *Async Generator* yang bisa di-loop untuk menerima event (`chunk`, `tool_call`, dll) secara real-time.

### Tipe & Interface yang Dapat Diimpor
Gunakan tipe-tipe ini untuk memastikan kode Anda *type-safe*.

* `ToolDefinition`: Objek untuk mendefinisikan tool (`name`, `description`, `parameters` via Zod).
* `Plugin`: Objek berisi metode *hook* (`onPreChat`, `onChatComplete`, dll) untuk memperluas fungsionalitas.
* `ChatStreamEvent`: Objek yang di-`yield` oleh `.chatStream()`. Memiliki `type` dan `content`.
* `CorePromptConfig`: Objek `{ content: string, password?: string }` untuk identitas dasar AI.
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

---

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
