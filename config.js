// Supabase project settings (Supabase → Project Settings → API Keys).
// Both values are meant to be public. Her data stays private because the database only
// lets a signed-in account read or change its own rows (Row Level Security).
window.MTWS_CONFIG = {
  supabaseUrl: 'https://qonrlqdwzcwknoirnwno.supabase.co',
  supabaseKey: 'sb_publishable_gfeVjRk0j3i_TNQ2pRqN6w_jC9GnwDE',
  // Public half of the push-notification key pair (the private half is a Supabase secret).
  vapidPublicKey: 'BHUdZNcLXl6H0zVv2ukShQhVUoOiez39gNdwGTzD03XpKRzKW7G1_rrwrB1vvqYm4dwF92JtrpFqWpCbZPht7Hg',
};
