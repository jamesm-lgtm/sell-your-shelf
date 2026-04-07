import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password === process.env.ADMIN_PASSWORD) {
    const token = Buffer.from(`admin:${Date.now()}`).toString('base64')
    return NextResponse.json({ token })
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
