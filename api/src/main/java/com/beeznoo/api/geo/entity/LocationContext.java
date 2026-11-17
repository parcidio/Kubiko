package com.beeznoo.api.geo.entity;

/** Onde a app pediu a localização: registo, KYC, tentativa de publicar ou abertura da app. */
public enum LocationContext {
    SIGNUP,
    KYC,
    PUBLISH,
    APP
}
