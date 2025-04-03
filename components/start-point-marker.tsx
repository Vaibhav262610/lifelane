"use client"

import { useEffect, useRef } from "react"
import type { google } from "google-maps"

interface StartPointMarkerProps {
  position: google.maps.LatLngLiteral
  isManuallyEntered?: boolean
  isMoving?: boolean
  vehicleType?: 'ambulance' | 'fire'
}

export function StartPointMarker({ 
  position, 
  isManuallyEntered = false,
  isMoving = false,
  vehicleType = 'ambulance'
}: StartPointMarkerProps) {
  const markerRef = useRef<google.maps.Marker | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const pulseCircleRef = useRef<google.maps.Circle | null>(null)
  const previousPositionRef = useRef<google.maps.LatLngLiteral | null>(null)
  const skipRenderRef = useRef<boolean>(false)

  useEffect(() => {
    if (!window.googleMap || !position) return;

    // Improved anti-jitter: Skip position updates that are very small
    if (previousPositionRef.current && markerRef.current) {
      const distanceChange = Math.sqrt(
        Math.pow(position.lat - previousPositionRef.current.lat, 2) +
        Math.pow(position.lng - previousPositionRef.current.lng, 2)
      );
      
      // If distance change is extremely small and we're moving, skip update to avoid micro-jitters
      // Increased threshold to 0.0003 (from 0.0001)
      if (distanceChange < 0.0003 && isMoving) {
        skipRenderRef.current = true;
        
        // Just update the position of existing marker and pulse instead of recreating
        markerRef.current.setPosition(position);
        if (pulseCircleRef.current) {
          pulseCircleRef.current.setCenter(position);
        }
        
        previousPositionRef.current = position;
        return;
      }
    }
    
    previousPositionRef.current = position;
    skipRenderRef.current = false;

    // If we're just updating position without changing marker type, skip full recreation
    if (markerRef.current && isMoving) {
      markerRef.current.setPosition(position);
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setCenter(position);
      }
      return;
    }

    // Clean up previous marker if it exists
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }

    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }
    
    if (pulseCircleRef.current) {
      pulseCircleRef.current.setMap(null)
      pulseCircleRef.current = null
    }

    // Choose appropriate icon based on state
    let markerIcon;
    
    if (isMoving) {
      // Use better images for ambulance and fire truck with direct image URLs
      markerIcon = {
        url: vehicleType === 'ambulance' 
          ? "https://maps.google.com/mapfiles/kml/shapes/hospitals.png" // More reliable ambulance icon
          : "https://maps.google.com/mapfiles/kml/shapes/firedept.png", // More reliable fire truck icon
        scaledSize: new window.google.maps.Size(42, 42),
        anchor: new window.google.maps.Point(21, 21),
      };
    } else {
      // Use custom circle icon when not moving
      markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: isManuallyEntered ? "#FF5722" : "#4285F4", // Orange for manually entered, blue for map selected
        fillOpacity: 1,
        strokeWeight: 3,
        strokeColor: "#FFFFFF",
      };
    }

    // Create the marker
    const marker = new window.google.maps.Marker({
      position,
      map: window.googleMap,
      icon: markerIcon,
      title: isMoving ? (vehicleType === 'ambulance' ? "Ambulance" : "Fire Truck") : "Starting Point",
      zIndex: 1000,
      animation: isMoving ? null : window.google.maps.Animation.DROP,
      // Add optimized property for better performance
      optimized: true
    });

    // Create the info window content based on state
    const infoContent = isMoving 
      ? `
        <div style="padding: 10px; min-width: 200px;">
          <div style="font-weight: bold; color: ${vehicleType === 'ambulance' ? '#2962FF' : '#FF3D00'}; margin-bottom: 8px; font-size: 14px;">
            Moving ${vehicleType === 'ambulance' ? 'Ambulance' : 'Fire Truck'}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Current Position:</strong> ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}
          </div>
          <div style="font-style: italic; font-size: 12px; color: #666;">
            Vehicle is moving along the route to destination
          </div>
        </div>
      `
      : `
        <div style="padding: 10px; min-width: 200px;">
          <div style="font-weight: bold; color: ${isManuallyEntered ? "#FF5722" : "#4285F4"}; margin-bottom: 8px; font-size: 14px;">
            ${isManuallyEntered ? "Manually Entered" : "Map Selected"} Starting Point
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Coordinates:</strong> ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}
          </div>
          <div style="font-style: italic; font-size: 12px; color: #666;">
            ${isManuallyEntered 
              ? "This starting point was manually entered in the control panel" 
              : "This starting point was selected by clicking on the map"}
          </div>
          <div style="margin-top: 8px; font-size: 12px;">
            Enter a destination and click "Preview Route" to see the path
          </div>
        </div>
      `;

    // Create an info window with appropriate content
    const infoWindow = new window.google.maps.InfoWindow({
      content: infoContent,
    });

    // Only open info window initially if not moving
    if (!isMoving) {
      infoWindow.open(window.googleMap, marker);
    }
    
    // Add click listener to toggle info window
    marker.addListener("click", () => {
      infoWindow.open(window.googleMap, marker);
    });

    // Create a pulse effect for moving vehicle
    if (isMoving) {
      const pulseCircle = new window.google.maps.Circle({
        strokeColor: vehicleType === 'ambulance' ? "#2962FF" : "#FF3D00",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: vehicleType === 'ambulance' ? "#2962FF" : "#FF3D00",
        fillOpacity: 0.15,
        map: window.googleMap,
        center: position,
        radius: 50, // 50 meter effect radius
        zIndex: 5,
      });
      
      pulseCircleRef.current = pulseCircle;
    }

    // Store references for cleanup
    markerRef.current = marker;
    infoWindowRef.current = infoWindow;

    // Clean up on unmount
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setMap(null);
      }
    };
  }, [position, isManuallyEntered, isMoving, vehicleType]); // Add vehicleType to dependencies

  return null; // This component doesn't render anything directly
} 