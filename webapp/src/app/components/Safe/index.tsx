import {
    getClient,
    getModule,
    getAccount,
    getMFAValidator,
    installModule,
    RHINESTONE_ATTESTER_ADDRESS,
    MOCK_ATTESTER_ADDRESS,
    getOwnableValidator,
    getWebAuthnValidator,
} from '@rhinestone/module-sdk'
import { useCallback, useState } from 'react'
import { usePublicClient, useAccount, useWalletClient } from 'wagmi'
import {
    useSendTransaction,
    useWaitForTransactionReceipt
} from "@permissionless/wagmi"
import { ToKernelSmartAccountReturnType, toSafeSmartAccount } from 'permissionless/accounts';
import { createWebAuthnCredential, entryPoint07Address, P256Credential, toWebAuthnAccount } from 'viem/account-abstraction';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { erc7579Actions } from "permissionless/actions/erc7579";
import { Account, Chain, http, Transport } from 'viem';
import { pimlicoClient, pimlicoSepoliaUrl } from '@/wagmi';
import { sepolia } from 'viem/chains';

export default function SafeComponent() {
    const [smartAccountClient, setSmartAccountClient] =
        useState<
            SmartAccountClient<
                Transport,
                Chain,
                ToKernelSmartAccountReturnType<"0.7">
            >
        >()
    const [credential, setCredential] = useState<P256Credential>(() =>
        JSON.parse(localStorage.getItem("credential") || "null")
    )
    const account = useAccount();
    const publicClient = usePublicClient();
    const walletClient = useWalletClient();
    const {
        sendTransaction,
        data: transactionReference,
        isPending
    } = useSendTransaction()

    const createCredential = async () => {
        const credential = await createWebAuthnCredential({
            name: "Wallet"
        })

        // NOTE: JSON.stringify is illegal in this context
        // localStorage.setItem("credential", JSON.stringify(credential))
        setCredential(credential)
    }

    const createSafe = useCallback(async () => {
        console.log('Creating Safe Account');
        const owner = account.address;
        const walletAccount = walletClient.data;
        if (!owner) {
            console.error('No owner');
            return;
        } else if (!walletAccount) {
            console.error('No wallet account');
            return;
        }

        // const owners = [walletAccount];

        // if (credential) {
        //     owners.push(toWebAuthnAccount({ credential }));
        // }

        const ownableValidator = getOwnableValidator({
            owners: [owner],
            threshold: 1,
        })
        const safeAccount = await toSafeSmartAccount({
            client: publicClient,
            owners: [walletAccount],
            version: '1.4.1',
            entryPoint: {
                address: entryPoint07Address,
                version: '0.7',
            },
            safe4337ModuleAddress: '0x7579EE8307284F293B1927136486880611F20002',
            erc7579LaunchpadAddress: '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
            attesters: [
                RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
                MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
            ],
            attestersThreshold: 1,
            validators: [
                {
                    address: ownableValidator.address,
                    context: ownableValidator.initData,
                },
            ],
        })
        console.log('Safe Account:', safeAccount);
        const smartAccountClient = createSmartAccountClient({
            account: safeAccount,
            paymaster: pimlicoClient,
            chain: sepolia,
            userOperation: {
                estimateFeesPerGas: async () =>
                    (await pimlicoClient.getUserOperationGasPrice())
                        .fast
            },
            bundlerTransport: http(pimlicoSepoliaUrl)
        }).extend(erc7579Actions());
        setSmartAccountClient(smartAccountClient as any);

    }, [account, publicClient, sendTransaction, walletClient.data, credential]);

    const installWebAuthnModule = useCallback(async () => {
        if (!smartAccountClient) {
            console.error('No smart account client');
            return;
        } else if (!credential) {
            console.error('No credential');
            return;
        }

        
        // const module = getWebAuthnValidator({
        //     webAuthnCredential: {
        //         pubKeyX: credential.publicKey.x,
        //         pubKeyY: credential.publicKey.y,
        //         authenticatorId: "Wallet"
        //     }
        // });

    }, [smartAccountClient, credential]);

    return (
        <div>
            <h1 className='text-4xl'>Safe Component</h1>
            {smartAccountClient ?
                <>
                    <h2>Account: {smartAccountClient.account.address}</h2>
                    {credential ?
                        <div>
                            <h2>WebAuthn Credential</h2>
                            <p>id: {credential.id}</p>
                            <button onClick={installWebAuthnModule}>Install WebAuthn Module</button>
                        </div> :
                        <button onClick={createCredential}>Create Credential</button>
                    }
                </> :
                <>
                    <button
                        className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
                        onClick={createSafe}
                    >
                        Create Safe Account
                    </button>
                </>
            }
        </div>
    );
}
