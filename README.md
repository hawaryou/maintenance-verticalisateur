# ENR12-V02 — Maintenance appareil de transfert verticalisateur

Application web mobile reprenant le style et les fonctionnalités du projet ENR11-V02. La checklist reprend les contrôles visuels et fonctionnels ainsi que la décision de maintien en service de la fiche ENR12-V02 fournie.

Fonctionnalités :
- maintenance annuelle ou périodique ;
- lecture QR Code, Data Matrix, Code 128 et EAN-13 par caméra ou photo ;
- contrôles avec choix non applicable / conforme / non conforme ;
- saisie des numéros de sangles ;
- décision de maintien en service : approuvé, approuvé sous réserve, non approuvé ;
- PDF avec résultat des contrôles, signatures, observations, pièces changées et niveau d’obsolescence ;
- envoi du PDF par e-mail via Google Apps Script ;
- mode normal et tournée multi-appareils avec une seule signature client.

## Déploiement

Publier les fichiers du dépôt sur GitHub Pages. Pour l’envoi e-mail, déployer `Code.gs` comme application Web Google Apps Script et vérifier le destinataire configuré avant mise en service.
