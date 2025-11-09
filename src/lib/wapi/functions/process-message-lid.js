/*
 * This file is part of WPPConnect.
 *
 * WPPConnect is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WPPConnect is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with WPPConnect.  If not, see <https://www.gnu.org/licenses/>.
 */
import { processLidTransformObj } from '../helper/process-lid-transform';

export async function processMessageObj(
  messageObj,
  includeMe,
  includeNotifications
) {
  const serializedMsg = WAPI._serializeMessageObj(messageObj);
  const transformedMsg = await processLidTransformObj(serializedMsg);
  console.log('transformedMsg', transformedMsg);
  if (messageObj.isNotification) {
    if (includeNotifications) return transformedMsg;
    else return;
    // System message
    // (i.e. "Messages you send to this chat and calls are now secured with end-to-end encryption...")
  } else if (messageObj.id.fromMe === false || includeMe) {
    return transformedMsg;
  }
  return;
}
