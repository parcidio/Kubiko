package com.beeznoo.api.config;

/**
 * Expressões de {@code @PreAuthorize} por área do Admin (decisoes-produto.md 2026-11-18).
 * O SecurityConfig já exige ROLE_ADMIN em /api/v1/admin/**; isto acrescenta a permissão da área.
 */
public final class AdminAccess {

    private AdminAccess() {}

    public static final String ANY_ADMIN = "hasRole('ADMIN')";
    public static final String OVERVIEW = "hasRole('ADMIN') and hasAuthority('PERM_OVERVIEW')";
    public static final String OPERATIONS = "hasRole('ADMIN') and hasAuthority('PERM_OPERATIONS_DESK')";
    public static final String KYC = "hasRole('ADMIN') and hasAuthority('PERM_KYC')";
    public static final String USERS_READ = "hasRole('ADMIN') and hasAuthority('PERM_USERS_READ')";
    public static final String USERS_MANAGE = "hasRole('ADMIN') and hasAuthority('PERM_USERS_MANAGE')";
    public static final String USERS_NOTE = "hasRole('ADMIN') and hasAuthority('PERM_USERS_NOTE')";
    public static final String ITEMS_MODERATE = "hasRole('ADMIN') and hasAuthority('PERM_ITEMS_MODERATE')";
    public static final String MESSAGES = "hasRole('ADMIN') and hasAuthority('PERM_MESSAGES')";
    public static final String GROWTH = "hasRole('ADMIN') and hasAuthority('PERM_GROWTH_DESK')";
    public static final String AUDIT = "hasRole('ADMIN') and hasAuthority('PERM_AUDIT')";
    public static final String TEAM = "hasRole('ADMIN') and hasAuthority('PERM_TEAM')";
}
