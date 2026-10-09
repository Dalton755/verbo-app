// Chave publicável Supabase; nunca colocar service_role ou segredos neste arquivo.
window.VERBO_CONFIG = Object.freeze({
  supabaseUrl: 'https://uhuowymzlqstnaajcuta.supabase.co',
  supabasePublishableKey: 'sb_publishable_g9frRIEMnl9_la6XwLEyQQ_vGBWJDDR',
  // JWT público legado de perfil anon: usado apenas no GET de Storage privado.
  // Não confundir com service_role (que nunca deve estar no navegador).
  storageAnonJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodW93eW16bHFzdG5hYWpjdXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTgwODIsImV4cCI6MjEwNjI5NDA4Mn0.hZAjDyvTdN4U29Y5nOLAp42RQ_vaJ_HnuhhYPRtV2Pw',
  storageBucket: 'verbo-acervo',
  shalomUrl: '' // Definir quando houver link oficial do Shalom.
});