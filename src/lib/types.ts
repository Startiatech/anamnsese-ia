export interface AccessRequest {
  id: string
  name: string
  email: string
  specialty: string
  phone: string
  message?: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
  /** Apenas para status='approved': se o usuario criado ainda tem senha temporaria. */
  userPasswordIsTemp?: boolean
}

export interface NewUser {
  email: string
  tempPassword: string
}
