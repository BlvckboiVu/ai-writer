// lib/indexeddb-manager.ts
import Dexie, { Table } from 'dexie'

interface DocumentMetadata {
  wordCount: number
  lastModified: string
  version: number
  tags: string[]
  aiSuggestions?: any[]
}

interface Document {
  id: string
  userId: string
  title: string
  content: Uint8Array
  metadata: DocumentMetadata
  syncStatus: 'synced' | 'pending' | 'conflict'
  iv: Uint8Array
}

interface Draft {
  documentId: string
  content: Uint8Array
  iv: Uint8Array
  timestamp: string
}

interface AIContext {
  documentId: string
  context: Uint8Array
  iv: Uint8Array
  timestamp: string
}

class NovelDexieDB extends Dexie {
  documents!: Table<Document, string>
  drafts!: Table<Draft, string>
  aiContext!: Table<AIContext, string>

  constructor() {
    super('NovelWritingApp')
    this.version(1).stores({
      documents: '&id, userId, syncStatus',
      drafts: '&documentId',
      aiContext: '&documentId'
    })
  }
}

class CryptoManager {
  async generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  async encryptData(data: string, userKey: string): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const key = await this.generateKey(userKey, salt)
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    )

    return {
      encrypted: new Uint8Array(encrypted),
      iv: new Uint8Array([...salt, ...iv])
    }
  }

  async decryptData(encryptedData: Uint8Array, iv: Uint8Array, userKey: string): Promise<string> {
    const salt = iv.slice(0, 16)
    const actualIv = iv.slice(16)

    const key = await this.generateKey(userKey, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: actualIv },
      key,
      encryptedData
    )

    return new TextDecoder().decode(decrypted)
  }
}

const db = new NovelDexieDB()
const cryptoManager = new CryptoManager()

export class SecureIndexedDBManager {
  private db = db
  private crypto = cryptoManager

  async saveDocument(document: {
    id: string
    userId: string
    title: string
    content: string
    metadata: DocumentMetadata
  }, userKey: string): Promise<void> {
    const { encrypted, iv } = await this.crypto.encryptData(document.content, userKey)

    await this.db.documents.put({
      id: document.id,
      userId: document.userId,
      title: document.title,
      content: encrypted,
      metadata: {
        ...document.metadata,
        lastModified: new Date().toISOString(),
        version: (document.metadata.version || 0) + 1
      },
      syncStatus: 'pending',
      iv
    })

    await this.saveDraft(document.id, document.content, userKey)
  }

  async getDocument(id: string, userKey: string): Promise<any | null> {
    const doc = await this.db.documents.get(id)
    if (!doc) return null
    const content = await this.crypto.decryptData(doc.content, doc.iv, userKey)
    return { ...doc, content }
  }

  async saveDraft(documentId: string, content: string, userKey: string): Promise<void> {
    const { encrypted, iv } = await this.crypto.encryptData(content, userKey)
    await this.db.drafts.put({
      documentId,
      content: encrypted,
      iv,
      timestamp: new Date().toISOString()
    })
  }

  async getPendingSync(): Promise<string[]> {
    const pending = await this.db.documents.where('syncStatus').equals('pending').toArray()
    return pending.map(doc => doc.id)
  }

  async markAsSynced(documentId: string): Promise<void> {
    const doc = await this.db.documents.get(documentId)
    if (doc) {
      doc.syncStatus = 'synced'
      await this.db.documents.put(doc)
    }
  }

  async getAllDocuments(userId: string): Promise<any[]> {
    return this.db.documents.where('userId').equals(userId).toArray()
  }

  async getConflicts(): Promise<any[]> {
    return this.db.documents.where('syncStatus').equals('conflict').toArray()
  }

  async saveAIContext(documentId: string, context: any, userKey: string): Promise<void> {
    const { encrypted, iv } = await this.crypto.encryptData(JSON.stringify(context), userKey)
    await this.db.aiContext.put({
      documentId,
      context: encrypted,
      iv,
      timestamp: new Date().toISOString()
    })
  }

  async getAIContext(documentId: string, userKey: string): Promise<any | null> {
    const ai = await this.db.aiContext.get(documentId)
    if (!ai) return null
    const decrypted = await this.crypto.decryptData(ai.context, ai.iv, userKey)
    return JSON.parse(decrypted)
  }
}
