package com.beeznoo.api.common.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;

/**
 * Liga o storage à transação da BD: ficheiros enviados são apagados se a transação fizer rollback,
 * e ficheiros a remover só são apagados depois do commit. Nos logs nunca entra a storage_key.
 */
@Slf4j
public final class StorageTransactions {

    private StorageTransactions() {}

    // Devolve a lista onde se vão juntando as chaves enviadas nesta transação
    public static List<String> deleteOnRollback(StorageService storage) {
        List<String> keys = new ArrayList<>();
        register(storage, keys, TransactionSynchronization.STATUS_ROLLED_BACK);
        return keys;
    }

    public static void deleteAfterCommit(StorageService storage, List<String> keys) {
        register(storage, keys, TransactionSynchronization.STATUS_COMMITTED);
    }

    private static void register(StorageService storage, List<String> keys, int whenStatus) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != whenStatus) return;
                for (String key : keys) {
                    try {
                        storage.delete(key);
                    } catch (RuntimeException e) {
                        // sem a exceção completa: a mensagem do S3 pode trazer a storage_key
                        log.warn("Storage: falha ao apagar ficheiro ({})", e.getClass().getSimpleName());
                    }
                }
            }
        });
    }
}
