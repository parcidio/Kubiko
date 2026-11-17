package com.beeznoo.api.geo.repository;

import com.beeznoo.api.geo.entity.ServiceArea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ServiceAreaRepository extends JpaRepository<ServiceArea, UUID> {

    List<ServiceArea> findByActiveTrueOrderByProvinceAscCityAsc();

    List<ServiceArea> findAllByOrderByProvinceAscCityAsc();

    boolean existsByProvinceIgnoreCaseAndCityIgnoreCase(String province, String city);

    boolean existsByProvinceIgnoreCaseAndCityIgnoreCaseAndIdNot(String province, String city, UUID id);
}
