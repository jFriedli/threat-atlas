import type { ElementType, StrideId } from './domain'
export const STRIDE:{id:StrideId;letter:string;name:string;guidance:string}[]=[
 {id:'spoofing',letter:'S',name:'Spoofing',guidance:'Can an attacker impersonate a user, service, system, or trusted component?'},
 {id:'tampering',letter:'T',name:'Tampering',guidance:'Can an attacker modify data, requests, files, configuration, or communication?'},
 {id:'repudiation',letter:'R',name:'Repudiation',guidance:'Can actions occur without sufficient evidence to attribute or audit them?'},
 {id:'information-disclosure',letter:'I',name:'Information Disclosure',guidance:'Can sensitive information become available to unauthorized parties?'},
 {id:'denial-of-service',letter:'D',name:'Denial of Service',guidance:'Can an attacker make this component or flow unavailable or excessively expensive?'},
 {id:'elevation-of-privilege',letter:'E',name:'Elevation of Privilege',guidance:'Can a user or component obtain capabilities beyond those it should have?'}]
export const suggestions:Record<ElementType|'edge',StrideId[]>={external:['spoofing','repudiation'],process:STRIDE.map(x=>x.id),store:['tampering','repudiation','information-disclosure','denial-of-service'],boundary:['spoofing','tampering','information-disclosure'],edge:['tampering','information-disclosure','denial-of-service']}
export const stride=(id:StrideId)=>STRIDE.find(x=>x.id===id)!
