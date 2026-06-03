import type { Progress } from 'ky'
import { createClient } from '@kkfive/request'

const http = createClient({
  prefix: 'https://api.example.com',
  responseParser: { responseReturn: 'data' },
})

interface UploadResult {
  id: string
  url: string
}

/**
 * 标准 multipart/form-data 上传。
 * 不要手动设置 Content-Type；kk-request 会删除已有值，让 fetch 自动补 multipart boundary。
 */
export async function uploadFormData(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('filename', file.name)

  return await http.post<UploadResult>('/upload', formData)
}

/**
 * 上传单个二进制 body。
 * 这种场景不是 multipart/form-data，可以按后端约定显式设置 Content-Type。
 */
export async function uploadRawFile(file: File): Promise<UploadResult> {
  return await http.request<UploadResult>('/upload/raw', {
    method: 'POST',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })
}

/**
 * 上传进度使用 ky 原生 onUploadProgress。
 * 浏览器支持取决于 request streams；不支持的环境会忽略该回调。
 */
export async function uploadWithProgress(
  file: File,
  onProgress: (progress: Progress) => void,
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  return await http.post<UploadResult>('/upload', formData, {
    onUploadProgress: (progress) => {
      onProgress(progress)
    },
  })
}
