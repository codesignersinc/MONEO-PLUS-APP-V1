// OCR text (tesseract.js, Spanish) of real app vouchers (Yape, BCP, Interbank), with the
// names, phone numbers, message and operation/account numbers replaced by fake ones.
// The OCR noise is kept as read.
export const YAPE_OCR =
  '1:44 . 55 EJ\n\nUT\no ON RI\nLe 7 :\nFr - E "TON\n-\nA\n\n¡Yapeaste! Compartir\n\nsI 50\n\nRocio Val*\nE 05 ago. 2026 | O 1:44 p.m.\n\nE Cena viernes 7 de Agosto Ana\nRuiz 8pm\n\nCÓDIGO DE SEGURIDAD (1)\n\nDATOS DE LA TRANSACCIÓN\n\nNro. de celular 4 000\nDestino Yape\nNro. de operación 11112222\n\nMás en Yape (E\n\n172) E\n\nTs Tarjete 10 con has\'a\n\ns/200 1 ,\n\nde bienvenida\n\nADE Ann.\n';

export const BCP_OCR =
  '2BCP>\n\n¡Operación exitosa!\n\n5/ 70.00\n\nDomingo 28 Junio 2026 - 09:54 am.\n\nEnviado a LUIS ALBERTO RAMOS PEREZ\nWe **Q 000\n\nPLIN\n\nComisión Gratis\nDesde Ahorro Soles\nXXX 1234\n\nNúmero de operación 00012345\n';

export const INTERBANK_OCR =
  'LJ Interbank\n¡Pago exitoso!\ns/ 66.00\nEnviado a:\nMario P Soto R\n900 000000 - Yape\nComisión:\nGRATIS\nFecha y hora:\n11 Sep 2026 11:34 AM\nCódigo de operación:\n50000001\n';

export const YAPE_OCR_PASS1 =
  '1:44 .:11 56 E\nY Pe Na sa\n9 q ME ABRANAM\nEr >. - VALDELOMAR\nDN DL AZ » AU\n¡Yapeaste! % Compartir\nRocio Val*\n8 05 ago. 2026 | O 1:44 p.m.\nEl Cena viernes 7 de Agosto Ana\nRuiz 8pm\nCÓDIGO DE SEGURIDAD QQ 123\nDATOS DE LA TRANSACCIÓN\nNro. de celular A + 000\nDestino Yape\nNro. de operación 11112222\nMás en Yape\nvo k\n16\nTu Tarjeta ¡O con hasta e,\nde bienvenida A\n';

export const BCP_OCR_PASS1 =
  '>BCP>\n¡Operación exitosa!\nDomingo 28 Junio 2026 - 09:54 am.\nEnviado a LUIS ALBERTO RAMOS PEREZ\nXX **Q 000\nPLIN\nComisión Gratis\nDesde Ahorro Soles\nEA 1234\nNúmero de operación 00012345\n';

// Plin app "Constancia" (anonymized), as read from a phone screenshot.
export const PLIN_APP_OCR =
  '11:14 4 56\nConstancia\n¡Pago exitoso!\ns/30.00\nEnviado a:\nAna M Soto R\n900 000 001 - Yape\nComisión:\nGRATIS\nFecha y hora:\n05 Oct 2026 11:14 PM\nCódigo de operación:\n11223344\n— 0\nInicio Movimientos Beneficios Para ti';

// Noisy phone OCR: accents misread, the currency alone on its line and noise before the
// big amount.
export const BCP_OCR_NOISY =
  '2BCP>\n\n¡Operacién exitosa!\n\nS/\n|\n70.00\n\nDomingo 28 Junio 2026 - 09:54 am.\n\nEnviado a LUIS ALBERTO RAMOS PEREZ\nWE **Q 000\n\nPLIN\n\nComisién Gratis\nDesde Ahorro Soles\nXXX 1234\n\nNúmero de operacion 00012345';
export const YAPE_OCR_NOISY =
  'iYapeaste!\n—\n.\n300\nAna Maria Torres\n19 set. 2026 | 05:03 p. m.\nDATOS DE LA TRANSACCION\nNro. de celular *** *** 000\nDestino Plin\nNro. de operacion 6300001';
