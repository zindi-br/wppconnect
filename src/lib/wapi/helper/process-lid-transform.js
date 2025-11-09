/*
 * This file is part of WPPConnect.
 *
 * WPPConnect is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WPPConnect is distributed in the hope that it will be useful,
 * but WITHOUT even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with WPPConnect.  If not, see <https://www.gnu.org/licenses/>.
 */

import { getPnLidEntry } from '../functions/get-pnLidEntry';

/**
 * Transforma campos que contêm @lid em @c.us e cria novos campos chatLid e chatPhone
 * @param {Object} messageObj - Objeto da mensagem serializada
 * @returns {Promise<Object>} Objeto da mensagem transformado
 */
export async function processLidTransformObj(messageObj) {
  if (!messageObj) {
    return messageObj;
  }

  // Cria uma cópia profunda do objeto para não modificar o original
  const transformed = JSON.parse(JSON.stringify(messageObj));

  // Função auxiliar para verificar se uma string contém @lid
  const containsLid = (str) => {
    return typeof str === 'string' && str.includes('@lid');
  };

  // Função auxiliar para extrair o número do @lid de uma string
  const extractLidFromString = (str) => {
    if (!containsLid(str)) {
      return null;
    }
    // Extrai o padrão número@lid de uma string
    const match = str.match(/(\d+)@lid/);
    return match ? `${match[1]}@lid` : null;
  };

  // Cache para evitar múltiplas chamadas ao getPnLidEntry para o mesmo número
  const lidCache = new Map();

  // Função auxiliar para obter o número @c.us a partir de um @lid
  const getCusFromLid = async (lidValue) => {
    if (!lidValue || !containsLid(lidValue)) {
      return null;
    }

    // Extrai o número @lid puro (ex: '262615792128098@lid')
    const lidMatch = lidValue.match(/(\d+)@lid/);
    if (!lidMatch) {
      return null;
    }

    const pureLid = `${lidMatch[1]}@lid`;

    // Verifica o cache
    if (lidCache.has(pureLid)) {
      return lidCache.get(pureLid);
    }

    try {
      const entry = await getPnLidEntry(pureLid);
      if (entry && entry.phoneNumber && entry.phoneNumber._serialized) {
        const cusValue = entry.phoneNumber._serialized;
        lidCache.set(pureLid, cusValue);
        return cusValue;
      }
    } catch (error) {
      console.error('Erro ao obter número @c.us de @lid:', error);
    }

    return null;
  };

  // Função recursiva para transformar todos os campos que contêm @lid
  const transformFields = async (obj, path = '') => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      if (containsLid(obj)) {
        // Extrai o número @lid da string
        const lidValue = extractLidFromString(obj);
        if (lidValue) {
          const cusValue = await getCusFromLid(lidValue);
          if (cusValue) {
            // Substitui @lid por @c.us na string
            return obj
              .replace(/@lid/g, '@c.us')
              .replace(lidValue.split('@lid')[0], cusValue.split('@c.us')[0]);
          }
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(
        obj.map((item, index) => transformFields(item, `${path}[${index}]`))
      );
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          result[key] = await transformFields(
            obj[key],
            path ? `${path}.${key}` : key
          );
        }
      }
      return result;
    }

    return obj;
  };

  // Guarda o valor original do chatId ou from antes da transformação
  const originalChatId = transformed.chatId;
  const originalFrom = transformed.from;

  // Transforma recursivamente todos os campos que contêm @lid
  const transformedObj = await transformFields(transformed);

  // Cria os novos campos chatLid e chatPhone
  // Usa o campo chatId ou from original (antes da transformação) como referência
  const referenceField = originalChatId || originalFrom;

  if (referenceField && containsLid(referenceField)) {
    // Extrai o número @lid puro
    const lidMatch = referenceField.match(/(\d+)@lid/);
    if (lidMatch) {
      const pureLid = `${lidMatch[1]}@lid`;

      try {
        const entry = await getPnLidEntry(pureLid);
        if (entry) {
          // chatLid: mantém o número com @lid original
          transformedObj.chatLid = entry.lid ? entry.lid._serialized : pureLid;

          // chatPhone: obtém o número com @c.us
          transformedObj.chatPhone = entry.phoneNumber
            ? entry.phoneNumber._serialized
            : null;
        } else {
          // Fallback se getPnLidEntry não retornar o formato esperado
          transformedObj.chatLid = pureLid;
          const cusValue = await getCusFromLid(pureLid);
          if (cusValue) {
            transformedObj.chatPhone = cusValue;
          }
        }
      } catch (error) {
        console.error(
          'Erro ao obter getPnLidEntry para chatLid/chatPhone:',
          error
        );
        // Fallback
        transformedObj.chatLid = pureLid;
        const cusValue = await getCusFromLid(pureLid);
        if (cusValue) {
          transformedObj.chatPhone = cusValue;
        }
      }
    }
  } else if (referenceField && referenceField.includes('@c.us')) {
    // Se já for @c.us, mantém como chatPhone
    transformedObj.chatPhone = referenceField;
  }

  return transformedObj;
}
