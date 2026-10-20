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
    return jsonENR12_({ok:true, message:'Fiche verticalisateur envoyée.'});
  } catch (err) {
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
