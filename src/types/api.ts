export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface PageRequest {
  pageNum?: number
  pageSize?: number
}

export interface PageResp<T> {
  total: number
  list: T[]
}
