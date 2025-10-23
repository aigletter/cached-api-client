import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Використовуємо 'node' оскільки ми тестуємо логіку сервісів (API клієнт, сховища),
        // які не залежать від браузера чи DOM. Це найшвидший варіант.
        environment: 'node',

        // Дозволяє використовувати глобальні функції тестування (describe, it, expect)
        // без необхідності імпорту в кожен файл.
        globals: true,

        // Шаблони для пошуку тестових файлів
        include: ['**/*.test.ts'],

        // Налаштування для покриття коду (coverage)
        coverage: {
            provider: 'v8', // Або 'istanbul'
            enabled: true,
            reporter: ['text', 'json', 'html'],
            // Шляхи, які потрібно включити до звіту про покриття
            include: ['src/**/*.ts'],
            // Шляхи, які потрібно виключити (наприклад, конфігураційні чи тестові утиліти)
            exclude: [
                'src/**/index.ts',
                'src/test-utils/**',
                '**/*.test.ts'
            ],
        },

        // Встановлення псевдонімів (aliases), якщо вони використовуються у вашому коді (наприклад, @/src)
        alias: [
            // { find: '@', replacement: path.resolve(__dirname, './src') },
        ],
    },
});