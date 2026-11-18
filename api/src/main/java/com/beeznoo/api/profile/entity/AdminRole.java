package com.beeznoo.api.profile.entity;

import java.util.EnumSet;
import java.util.Set;

import static com.beeznoo.api.profile.entity.AdminPermission.*;

/**
 * Papel dentro da equipa (decisoes-produto.md 2026-11-18). Só existe para contas com role ADMIN.
 * As permissões são lidas da BD em cada pedido (JwtAuthFiltter) e viram autoridades {@code PERM_<permissão>}.
 */
public enum AdminRole {
    SUPER_ADMIN(EnumSet.allOf(AdminPermission.class)),
    OPERATIONS(EnumSet.of(OVERVIEW, OPERATIONS_DESK, USERS_READ, USERS_NOTE, ITEMS_MODERATE, MESSAGES)),
    TRUST(EnumSet.of(OVERVIEW, KYC, USERS_READ, USERS_MANAGE, USERS_NOTE, ITEMS_MODERATE, MESSAGES)),
    GROWTH(EnumSet.of(OVERVIEW, GROWTH_DESK, USERS_READ, MESSAGES));

    private final Set<AdminPermission> permissions;

    AdminRole(Set<AdminPermission> permissions) {
        this.permissions = permissions;
    }

    public Set<AdminPermission> permissions() {
        return permissions;
    }
}
