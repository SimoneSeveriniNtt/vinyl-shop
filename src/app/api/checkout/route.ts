import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Use service role key for server-side operations (bypasses RLS safely)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONDITION_LABELS: Record<string, string> = {
  "Mint":      "Perfetto",
  "Near Mint": "Quasi Perfetto",
  "Very Good": "Molto Buono",
  "Good":      "Buono",
  "Fair":      "Discreto",
  "Poor":      "Mediocre",
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "simone.severini@gmail.com";
const RESEND_FROM = process.env.RESEND_FROM || "Vinyl Shop <onboarding@resend.dev>";
const SHOP_LOGO_URL = process.env.SHOP_LOGO_URL || "https://vinyl-shop-amber.vercel.app/favicon.svg";

interface OrderItem {
  id: string;
  title: string;
  artist: string;
  price: number;
  condition: string;
  cover_url: string | null;
  quantity: number;
}

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  cap: string;
  country: string;
  notes: string;
}

function generateAdminEmail(
  customer: CustomerData,
  items: OrderItem[],
  subtotal: number,
  shipping: number,
  total: number,
  orderId: string,
  orderDate: string
): string {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${
              item.cover_url
                ? `<img src="${item.cover_url}" alt="${item.title}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" />`
                : `<div style="width: 60px; height: 60px; border-radius: 8px; background: #f4f4f5; display: flex; align-items: center; justify-content: center; color: #d4d4d8; font-size: 12px;">N/A</div>`
            }
            <div>
              <strong style="color: #18181b; font-size: 14px;">${item.title}</strong><br/>
              <span style="color: #71717a; font-size: 13px;">${item.artist}</span><br/>
              <span style="color: #a1a1aa; font-size: 12px;">Condizione: ${CONDITION_LABELS[item.condition] || item.condition}</span>
            </div>
          </div>
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #52525b;">${item.quantity}</td>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #18181b;">€${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <img src="${SHOP_LOGO_URL}" alt="Vinyl Shop" width="56" height="56" style="display:block; margin: 0 auto 12px; border-radius: 999px; background: #ffffff; padding: 8px;" />
      <h1 style="margin: 0; color: #fbbf24; font-size: 28px; letter-spacing: -0.5px;">🎵 Vinyl Shop</h1>
      <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 14px;">🛒 Nuovo ordine ricevuto!</p>
    </div>

    <!-- Order info banner -->
    <div style="background: #fef3c7; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #92400e; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Ordine</span><br/>
        <strong style="color: #78350f; font-size: 16px;">#${orderId.substring(0, 8).toUpperCase()}</strong>
      </div>
      <div style="text-align: right;">
        <span style="color: #92400e; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Data</span><br/>
        <strong style="color: #78350f; font-size: 14px;">${orderDate}</strong>
      </div>
    </div>

    <!-- Main content -->
    <div style="background: #ffffff; padding: 32px;">
      
      <!-- Customer details -->
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #18181b; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">👤 Dati Cliente</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #71717a; font-size: 14px; width: 140px;">Nome completo</td>
          <td style="padding: 8px 0; color: #18181b; font-size: 14px; font-weight: 600;">${customer.firstName} ${customer.lastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Email</td>
          <td style="padding: 8px 0; color: #18181b; font-size: 14px;"><a href="mailto:${customer.email}" style="color: #2563eb; text-decoration: none;">${customer.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Telefono</td>
          <td style="padding: 8px 0; color: #18181b; font-size: 14px;"><a href="tel:${customer.phone}" style="color: #2563eb; text-decoration: none;">${customer.phone}</a></td>
        </tr>
      </table>

      <!-- Shipping address -->
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #18181b; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">📦 Indirizzo di Spedizione</h2>
      <div style="background: #fafafa; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #fbbf24;">
        <p style="margin: 0; color: #18181b; font-size: 14px; line-height: 1.6;">
          <strong>${customer.firstName} ${customer.lastName}</strong><br/>
          ${customer.address}<br/>
          ${customer.cap} ${customer.city} (${customer.province.toUpperCase()})<br/>
          ${customer.country}
        </p>
      </div>

      ${
        customer.notes
          ? `
      <!-- Notes -->
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #18181b; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">📝 Note del Cliente</h2>
      <div style="background: #fffbeb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #78350f; font-size: 14px; font-style: italic;">"${customer.notes}"</p>
      </div>
      `
          : ""
      }

      <!-- Order items -->
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #18181b; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">🎶 Vinili Ordinati</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #fafafa;">
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Prodotto</th>
            <th style="padding: 12px 16px; text-align: center; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Qtà</th>
            <th style="padding: 12px 16px; text-align: right; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Prezzo</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="background: #18181b; border-radius: 12px; padding: 20px; color: white;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #a1a1aa; font-size: 14px;">Subtotale</span>
          <span style="font-size: 14px;">€${subtotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #a1a1aa; font-size: 14px;">Spedizione</span>
          <span style="font-size: 14px;">${shipping === 0 ? "Gratis ✨" : `€${shipping.toFixed(2)}`}</span>
        </div>
        <div style="border-top: 1px solid #3f3f46; padding-top: 12px; display: flex; justify-content: space-between;">
          <strong style="font-size: 18px; color: #fbbf24;">TOTALE</strong>
          <strong style="font-size: 22px; color: #fbbf24;">€${total.toFixed(2)}</strong>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #27272a; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
      <p style="margin: 0; color: #71717a; font-size: 12px;">
        Email generata automaticamente da <strong style="color: #fbbf24;">Vinyl Shop</strong><br/>
        Ordine #${orderId.substring(0, 8).toUpperCase()} — ${orderDate}
      </p>
    </div>
  </div>
</body>
</html>`;
}

function generateBuyerEmail(
  customer: CustomerData,
  items: OrderItem[],
  subtotal: number,
  shipping: number,
  total: number,
  orderId: string,
  orderDate: string
): string {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0;">
          ${item.cover_url ? `<img src="${item.cover_url}" alt="${item.title}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; float: left; margin-right: 12px;" />` : ""}
          <strong style="color: #18181b; font-size: 14px;">${item.title}</strong><br/>
          <span style="color: #71717a; font-size: 13px;">${item.artist}</span><br/>
          <span style="color: #a1a1aa; font-size: 12px;">Condizione: ${CONDITION_LABELS[item.condition] || item.condition}</span>
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #52525b;">${item.quantity}</td>
        <td style="padding: 16px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #18181b;">€${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#18181b 0%,#27272a 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <img src="${SHOP_LOGO_URL}" alt="Vinyl Shop" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:999px;background:#ffffff;padding:8px;" />
      <h1 style="margin:0;color:#fbbf24;font-size:28px;">🎵 Vinyl Shop</h1>
      <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">Grazie per il tuo acquisto!</p>
    </div>
    <div style="background:#d1fae5;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#065f46;font-size:16px;font-weight:600;">✅ Ordine confermato — #${orderId.substring(0, 8).toUpperCase()}</p>
      <p style="margin:4px 0 0;color:#047857;font-size:13px;">${orderDate}</p>
    </div>
    <div style="background:#ffffff;padding:32px;">
      <p style="color:#18181b;font-size:15px;">Ciao <strong>${customer.firstName}</strong>,</p>
      <p style="color:#52525b;font-size:14px;line-height:1.6;">Il tuo ordine è stato ricevuto con successo. Ti contatteremo presto per organizzare la spedizione.</p>

      <h2 style="margin:24px 0 16px;font-size:18px;color:#18181b;border-bottom:2px solid #fbbf24;padding-bottom:8px;">📦 Indirizzo di Spedizione</h2>
      <div style="background:#fafafa;border-radius:12px;padding:16px;border-left:4px solid #fbbf24;margin-bottom:24px;">
        <p style="margin:0;color:#18181b;font-size:14px;line-height:1.6;">
          <strong>${customer.firstName} ${customer.lastName}</strong><br/>
          ${customer.address}<br/>
          ${customer.cap} ${customer.city} (${customer.province.toUpperCase()})<br/>
          ${customer.country}
        </p>
      </div>

      <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;border-bottom:2px solid #fbbf24;padding-bottom:8px;">🎶 Vinili Ordinati</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:12px 16px;text-align:left;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Prodotto</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Qtà</th>
            <th style="padding:12px 16px;text-align:right;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Prezzo</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="background:#18181b;border-radius:12px;padding:20px;color:white;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#a1a1aa;font-size:14px;">Subtotale</span>
          <span style="font-size:14px;">€${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#a1a1aa;font-size:14px;">Spedizione</span>
          <span style="font-size:14px;">${shipping === 0 ? "Gratis ✨" : `€${shipping.toFixed(2)}`}</span>
        </div>
        <div style="border-top:1px solid #3f3f46;padding-top:12px;display:flex;justify-content:space-between;">
          <strong style="font-size:18px;color:#fbbf24;">TOTALE</strong>
          <strong style="font-size:22px;color:#fbbf24;">€${total.toFixed(2)}</strong>
        </div>
      </div>
    </div>
    <div style="background:#27272a;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:12px;">
        Grazie per aver scelto <strong style="color:#fbbf24;">Vinyl Shop</strong><br/>
        Ordine #${orderId.substring(0, 8).toUpperCase()} — ${orderDate}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let reservedVinylIds: string[] = [];

  try {
    const body = await req.json();
    const { customer, items, subtotal, shipping, total } = body as {
      customer: CustomerData;
      items: OrderItem[];
      subtotal: number;
      shipping: number;
      total: number;
    };

    // Validate required fields
    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone || !customer.address || !customer.city || !customer.province || !customer.cap) {
      return NextResponse.json({ error: "Compila tutti i campi obbligatori" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Il carrello è vuoto" }, { status: 400 });
    }

    // Reserve all vinyls only if still available.
    // This prevents race conditions when two users try to buy the same record.
    const vinylIds = Array.from(new Set(items.map((item) => item.id)));
    const reservationTimestamp = new Date().toISOString();

    const { data: reservedRows, error: reserveError } = await supabase
      .from("vinyls")
      .update({ available: false, updated_at: reservationTimestamp })
      .in("id", vinylIds)
      .eq("available", true)
      .select("id, title");

    if (reserveError) {
      console.error("Vinyl reservation error:", reserveError);
      return NextResponse.json({ error: "Errore durante la verifica disponibilita prodotti" }, { status: 500 });
    }

    reservedVinylIds = (reservedRows || []).map((row) => row.id);

    if (reservedVinylIds.length !== vinylIds.length) {
      // Release any partial reservation to avoid locking items when checkout fails.
      if (reservedVinylIds.length > 0) {
        await supabase
          .from("vinyls")
          .update({ available: true, updated_at: new Date().toISOString() })
          .in("id", reservedVinylIds);
      }

      const { data: soldRows } = await supabase
        .from("vinyls")
        .select("title")
        .in("id", vinylIds)
        .eq("available", false);

      const soldTitles = (soldRows || []).map((row) => row.title).filter(Boolean);
      const soldMessage = soldTitles.length > 0
        ? `Prodotto non più disponibile: ${soldTitles.join(", ")}`
        : "Uno o più prodotti non sono più disponibili";

      return NextResponse.json({ error: soldMessage }, { status: 409 });
    }

    // Save order to Supabase
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`,
        total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      if (reservedVinylIds.length > 0) {
        await supabase
          .from("vinyls")
          .update({ available: true, updated_at: new Date().toISOString() })
          .in("id", reservedVinylIds);
      }
      return NextResponse.json({ error: "Errore nel salvataggio dell'ordine" }, { status: 500 });
    }

    // Save order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      vinyl_id: item.id,
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      if (reservedVinylIds.length > 0) {
        await supabase
          .from("vinyls")
          .update({ available: true, updated_at: new Date().toISOString() })
          .in("id", reservedVinylIds);
      }
      return NextResponse.json({ error: "Errore nel salvataggio dei prodotti ordine" }, { status: 500 });
    }

    // Format date
    const orderDate = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Generate email HTML for admin
    const adminEmailHtml = generateAdminEmail(customer, items, subtotal, shipping, total, order.id, orderDate);

    // Generate confirmation email HTML for buyer
    const buyerEmailHtml = generateBuyerEmail(customer, items, subtotal, shipping, total, order.id, orderDate);

    // Send emails via Resend. In no-domain mode (onboarding@resend.dev), recipient restrictions may apply.
    if (!resend) {
      console.error("Resend API key missing: skipped email sending.");
    } else {
      try {
        const adminResult = await resend.emails.send({
          from: RESEND_FROM,
          to: ADMIN_EMAIL,
          subject: `🎵 Nuovo Ordine #${order.id.substring(0, 8).toUpperCase()} — ${customer.firstName} ${customer.lastName} — €${total.toFixed(2)}`,
          html: adminEmailHtml,
          replyTo: customer.email,
        });

        if (adminResult.error) {
          console.error("Admin email error:", adminResult.error);
        }
      } catch (e) {
        console.error("Admin email error:", e);
      }

      try {
        const buyerResult = await resend.emails.send({
          from: RESEND_FROM,
          to: customer.email,
          subject: `✅ Ordine confermato #${order.id.substring(0, 8).toUpperCase()} — Vinyl Shop`,
          html: buyerEmailHtml,
        });

        if (buyerResult.error) {
          console.error("Buyer email error:", buyerResult.error);
        }
      } catch (e) {
        console.error("Buyer email error:", e);
      }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error("Checkout error:", error);

    if (reservedVinylIds.length > 0) {
      await supabase
        .from("vinyls")
        .update({ available: true, updated_at: new Date().toISOString() })
        .in("id", reservedVinylIds);
    }

    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
