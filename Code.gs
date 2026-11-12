/**
 * ENR12-V02 — Réception et envoi des fiches PDF verticalisateur.
 * Projet distinct de la fiche fauteuil roulant.
 * Dans Apps Script : déployer ce projet comme application Web, exécuter en tant que propriétaire.
 */
const DESTINATAIRE_ENR12 = 'valentineuromed@gmail.com';
const NOM_EXPEDITEUR_ENR12 = 'EuroMed - Maintenance verticalisateur';

function doGet() {
  return ContentService.createTextOutput('ENR12-V02 : service actif')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    euromedAuthorizeMail_(e);
    const p = e && e.parameter ? e.parameter : {};
    const tokenAttendu = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (tokenAttendu && p.token !== tokenAttendu) throw new Error('Token invalide.');
    const base64 = String(p.pdf_base64 || '');
    if (!base64) throw new Error('PDF manquant.');
    if (base64.length > 11000000) throw new Error('PDF trop volumineux pour cet envoi.');
    const nom = nomFichierENR12_(p.filename || 'ENR12-V02.pdf');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', nom);
    const reference = texteENR12_(p.reference, 180);
    const sujet = 'Maintenance appareil de transfert verticalisateur — ENR12-V02' + (reference ? ' — ' + reference : '');
    const corps = [
      'Bonjour,', '',
      'Veuillez trouver ci-joint la fiche de maintenance de l’appareil de transfert verticalisateur ENR12-V02.',
      '', 'Client / établissement : ' + texteENR12_(p.client, 250),
      'Technicien : ' + texteENR12_(p.technicien, 180),
      'Date : ' + texteENR12_(p.date, 40),
      'Référence intervention : ' + reference,
      'N° série / parc : ' + texteENR12_(p.serie, 250),
      '', 'Message généré automatiquement par EuroMed.', '', 'Cordialement,', 'EuroMed'
    ].join('\n');
    MailApp.sendEmail({to: DESTINATAIRE_ENR12, subject: sujet, body: corps, name: NOM_EXPEDITEUR_ENR12, attachments: [blob]});
    euromedLogMailEvent_(e, EUROMED_APP_KEY, 'accepted');
    return jsonENR12_({ok:true, message:'Fiche verticalisateur envoyée.'});
  } catch (err) {
    euromedLogMailEvent_(e, EUROMED_APP_KEY, 'failed', err && err.name ? err.name : 'error');
    console.error(err);
    return jsonENR12_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function jsonENR12_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function texteENR12_(v, max) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}
function nomFichierENR12_(v) {
  return String(v || 'ENR12-V02.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'ENR12-V02.pdf';
}

/**
 * EuroMed — vérification serveur avant tout envoi d'e-mail.
 * À copier dans CHAQUE projet Google Apps Script qui appelle MailApp/GmailApp.
 * Ne jamais journaliser ni enregistrer le jeton reçu.
 */
const EUROMED_AUTH_URL = 'https://nrtrraawiqfbajccfmzc.supabase.co';
const EUROMED_AUTH_PUBLIC_KEY = 'sb_publishable_mI8nBWjKRxTgn2b8ppAyoA_BaxQI4zx';
// À personnaliser différemment dans chaque projet Apps Script.
const EUROMED_APP_KEY = 'maintenance-verticalisateur';

function euromedAuthorizeMail_(event) {
  const params = {};
  if (event && event.parameter) {
    Object.keys(event.parameter).forEach(function (key) {
      params[key] = event.parameter[key];
    });
  }

  const raw = event && event.postData && event.postData.contents
    ? String(event.postData.contents) : '';
  if (raw) {
    try {
      const object = JSON.parse(raw);
      if (object && typeof object === 'object' && !Array.isArray(object)) {
        Object.keys(object).forEach(function (key) { params[key] = object[key]; });
      }
    } catch (ignore) {
      raw.split('&').forEach(function (part) {
        const index = part.indexOf('=');
        if (index < 0) return;
        const key = decodeURIComponent(part.slice(0, index).replace(/\+/g, ' '));
        const value = decodeURIComponent(part.slice(index + 1).replace(/\+/g, ' '));
        if (!(key in params)) params[key] = value;
      });
    }
  }

  const accessToken = String(params.euromed_access_token || '').trim();
  if (!accessToken) throw new Error('Connexion EuroMed requise pour envoyer un e-mail.');

  const headers = {
    apikey: EUROMED_AUTH_PUBLIC_KEY,
    Authorization: 'Bearer ' + accessToken
  };
  const userResponse = UrlFetchApp.fetch(EUROMED_AUTH_URL + '/auth/v1/user', {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (userResponse.getResponseCode() !== 200) {
    throw new Error('Session EuroMed invalide ou expirée. Reconnectez-vous.');
  }
  const user = JSON.parse(userResponse.getContentText() || '{}');
  if (!user.id || !user.email) throw new Error('Compte EuroMed introuvable.');

  const profileUrl = EUROMED_AUTH_URL + '/rest/v1/euromed_profiles' +
    '?select=approved,role,active,session_revoked_at&id=eq.' + encodeURIComponent(user.id);
  const profileResponse = UrlFetchApp.fetch(profileUrl, {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (profileResponse.getResponseCode() !== 200) {
    throw new Error('Impossible de vérifier l’autorisation EuroMed.');
  }
  const profiles = JSON.parse(profileResponse.getContentText() || '[]');
  if (!profiles.length || profiles[0].approved !== true || profiles[0].active !== true) {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', profiles.length && profiles[0].active === false ? 'account-suspended' : 'account-not-approved');
    throw new Error('Compte EuroMed en attente de validation : envoi refusé.');
  }
  const issuedAt = euromedTokenIssuedAt_(accessToken);
  const revokedAt = profiles[0].session_revoked_at ? Math.floor(new Date(profiles[0].session_revoked_at).getTime() / 1000) : 0;
  if (!issuedAt || (revokedAt && issuedAt <= revokedAt)) {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', 'session-revoked');
    throw new Error('Session révoquée. Reconnectez-vous avec votre nouveau lien d’accès.');
  }

  const policyResponse = UrlFetchApp.fetch(EUROMED_AUTH_URL + '/rest/v1/rpc/euromed_get_mail_policy', {
    method: 'post', headers: headers, contentType: 'application/json', payload: '{}', muteHttpExceptions: true
  });
  if (policyResponse.getResponseCode() !== 200 || policyResponse.getContentText() !== 'true') {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', 'mail-paused');
    throw new Error('Les envois e-mail sont temporairement suspendus par l’administrateur EuroMed.');
  }
  return { id: user.id, email: user.email, role: profiles[0].role };
}

function euromedTokenIssuedAt_(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return 0;
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString();
    return Number(JSON.parse(decoded).iat || 0);
  } catch (ignore) { return 0; }
}

/**
 * Ajoute un événement minimal au suivi administrateur (sans destinataire ni contenu).
 * Appeler après l'envoi MailApp réussi, puis dans catch en cas d'échec.
 */
function euromedLogMailEvent_(event, appKey, status, errorCode) {
  try {
    const params = {};
    if (event && event.parameter) Object.keys(event.parameter).forEach(function (key) { params[key] = event.parameter[key]; });
    const raw = event && event.postData && event.postData.contents ? String(event.postData.contents) : '';
    if (raw) {
      try { Object.assign(params, JSON.parse(raw)); } catch (ignore) {
        raw.split('&').forEach(function (part) {
          const i = part.indexOf('='); if (i < 0) return;
          params[decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
        });
      }
    }
    const token = String(params.euromed_access_token || '').trim();
    if (!token) return;
    UrlFetchApp.fetch(EUROMED_AUTH_URL + '/rest/v1/rpc/euromed_log_mail_event', {
      method: 'post',
      headers: { apikey: EUROMED_AUTH_PUBLIC_KEY, Authorization: 'Bearer ' + token },
      contentType: 'application/json',
      payload: JSON.stringify({ p_app_key: String(appKey || 'inconnu').slice(0, 80), p_status: status, p_error_code: status === 'failed' ? String(errorCode || 'erreur').slice(0, 80) : null }),
      muteHttpExceptions: true
    });
  } catch (ignore) { /* Les journaux ne doivent jamais empêcher un envoi ou son traitement. */ }
}

