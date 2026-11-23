/**
 * One base game's index shared between pychivalry's programs on one machine
 * (docs/shared-index.md): the base game lent (`base.ts`), where it is found (`address.ts`), the
 * local channel (`channel.ts`) and the asking and lending (`host.ts`).
 */

export {
    addressFile,
    hostFolder,
    privateFolder,
    randomHex,
    readAddress,
    SHARED_ENVIRONMENT,
    sharedEnvironment,
    SHARING_VARIABLE,
    sharingOff,
    type AddressRecord,
} from './address.js';
export {
    baseMismatch,
    BaseRefused,
    forkBaseSteps,
    shareBase,
    type BaseIdentity,
    type SharedBase,
} from './base.js';
export { isLocalAddress, localAddress, MAX_SOCKET_PATH } from './channel.js';
export {
    askHost,
    CLAIM_MS,
    CONNECT_MS,
    HEARTBEAT_MS,
    IndexHost,
    PROTOCOL,
    SILENCE_MS,
    type AskOptions,
    type HostOptions,
    type HostReply,
    type HostRequest,
    type HostStatus,
    type Place,
} from './host.js';
