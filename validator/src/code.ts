import { config } from "./config";
import { SignProtocolClient, SpMode, Attestation } from "@ethsign/sp-sdk";
import { privateKeyToAccount } from "viem/accounts";

const client = new SignProtocolClient(SpMode.OnChain, {
    chain: config.chain,
    account: privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001'), // need it for the library to work
});

const schemaId = config.documentHashSchema.split('_').slice(-1)[0];

async function testAttestation(attestationId: string, hash: string): Promise<Boolean> {
    const res = await client.getAttestation(
        attestationId
    );
    if (res.revoked != false) {
        console.debug('revoked')
        return false
    }
    if (res.schemaId != schemaId) {
        console.debug('wrong schema got:', res.schemaId, " expected: ", schemaId)
        return false
    }
    if (res.attester != config.attester) {
        console.debug('wrong attester')
        return false
    }
    if (typeof res.data === 'object' && res.data !== null) {
        if (res.data['hashOfDocument'] != hash) {
            console.debug('wrong hash', res.data['hashOfDocument'], hash)
            return false
        }
    }
    return true
}

async function getAttestationId(hash: string): Promise<string | null> {
    interface Data {
        success: boolean;
        statusCode: number;
        data: {
            total: number;
            rows: any[];
            size: number;
            page: number;
        };
        message?: string;
    }
    console.log("test")
    const queryParams = {
        schemaId: config.documentHashSchema,
        attester: config.attester,
        indexingValue: hash,
    };
    console.log("test2")
    const queryString: string = new URLSearchParams(queryParams).toString();
    const fullUrl: string = config.baseUrl + 'index/attestations' + '?' + queryString;

    try {
        const response = await fetch(fullUrl);
        if (response.ok) {
            const data = await response.json() as Data;
            if (data.success && data.statusCode === 200) {
                if (data.data.total > 0) {
                    const firstElement = data.data.rows[0];
                    return firstElement.attestationId;
                } else {
                    console.debug('not found');
                    return null;
                }
            } else {
                throw new Error("Response indicates failure: " + data.message);
            }
        } else {
            console.error('Request failed with status:', response.status);
            throw new Error("Request failed with status:" + response.status);
        }
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

async function verifyHash(hash: string) {
    const id = await getAttestationId(hash);
    if (id === null) {
        return false
    }
    return testAttestation(id, hash);
}

export default verifyHash;