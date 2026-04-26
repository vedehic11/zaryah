import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

async function getAuthenticatedSeller(request) {
  const session = await requireAuth(request)

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const user = await getUserBySupabaseAuthId(session.user.id)
  if (!user || user.user_type !== 'Seller') {
    throw new Error('Forbidden')
  }

  return user
}

function normalizeSectionName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

// GET /api/seller-sections - fetch sections for authenticated seller
export async function GET(request) {
  try {
    const seller = await getAuthenticatedSeller(request)

    const { data, error } = await supabase
      .from('seller_sections')
      .select('id, name, created_at')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: true })

    if (error) {
      // Keep UI functional even if table is not created yet.
      if (error.code === '42P01') {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Only sellers can manage sections' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/seller-sections - create seller section
export async function POST(request) {
  try {
    const seller = await getAuthenticatedSeller(request)
    const body = await request.json()
    const sectionName = normalizeSectionName(body?.name)

    if (!sectionName) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 })
    }

    if (sectionName.length > 50) {
      return NextResponse.json({ error: 'Section name must be 50 characters or fewer' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('seller_sections')
      .select('id')
      .eq('seller_id', seller.id)
      .ilike('name', sectionName)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      if (existingError.code === '42P01') {
        return NextResponse.json({ error: 'seller_sections table is missing. Please run the database migration first.' }, { status: 500 })
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Section already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('seller_sections')
      .insert({
        seller_id: seller.id,
        name: sectionName
      })
      .select('id, name, created_at')
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'seller_sections table is missing. Please run the database migration first.' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Only sellers can manage sections' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/seller-sections?id=<uuid> - delete seller section
export async function DELETE(request) {
  try {
    const seller = await getAuthenticatedSeller(request)
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()

    if (!id) {
      return NextResponse.json({ error: 'Section id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('seller_sections')
      .delete()
      .eq('id', id)
      .eq('seller_id', seller.id)

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'seller_sections table is missing. Please run the database migration first.' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Only sellers can manage sections' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
