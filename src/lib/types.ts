export interface AccessRequest {
  id: string
  name: string
  email: string
  specialty: string
  phone: string
  message?: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface NewUser {
  email: string
  tempPassword: string
}
