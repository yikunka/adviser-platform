import { rm } from 'node:fs/promises'

const target = '.next'
const attempts = 6

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await rm(target, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 150,
    })
    process.exit(0)
  } catch (error) {
    if (attempt === attempts) {
      throw error
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 250))
  }
}
