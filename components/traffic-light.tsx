"use client"

import { useEffect, useRef, useState } from "react"
import type { google } from "google-maps"

interface TrafficLightProps {
  id: string
  position: { lat: number; lng: number }
  status: "red" | "yellow" | "green"
  onStatusChange?: (id: string, status: "red" | "yellow" | "green") => void
}

export function TrafficLight({ id, position, status, onStatusChange }: TrafficLightProps) {
  const markerRef = useRef<google.maps.Marker | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const prevStatusRef = useRef<string>(status)
  const [isBlinking, setIsBlinking] = useState(false)

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "red":
        return "#FF0000"
      case "yellow":
        return "#FFAA00"
      case "green":
        return "#00CC00"
      default:
        return "#CCCCCC"
    }
  }

  // Create traffic light SVG icon
  const createTrafficLightIcon = (currentStatus: string, blink: boolean = false) => {
    // Instead of SVG, use built-in Google Maps icons for better visibility
    let iconUrl = "";
    
    switch (currentStatus) {
      case "red":
        iconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
        break;
      case "yellow":
        iconUrl = "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
        break;
      case "green":
        iconUrl = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
        break;
      default:
        iconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
    }
    
    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(50, 50), // Make them large enough to see
      anchor: new window.google.maps.Point(25, 25),
    };
  };

  // Create and update the traffic light
  useEffect(() => {
    if (!window.googleMap) return

    // Create traffic light marker if it doesn't exist
    if (!markerRef.current) {
      // Create SVG traffic light icon
      const trafficLightIcon = createTrafficLightIcon(status);

      const marker = new window.google.maps.Marker({
        position,
        map: window.googleMap,
        icon: trafficLightIcon,
        title: `Traffic Light ${id}`,
        zIndex: 10,
      })

      // Create a radius circle to show affected area
      const circle = new window.google.maps.Circle({
        strokeColor: getStatusColor(status),
        strokeOpacity: 0.7,  // Increased from 0.5
        strokeWeight: 3,     // Increased from 2
        fillColor: getStatusColor(status),
        fillOpacity: 0.3,    // Increased from 0.2
        map: window.googleMap,
        center: position,
        radius: 150,         // Increased from 100 to make more visible
      })

      // Create an info window for this traffic light
      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(id, status),
      })

      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.open(window.googleMap, marker)
        }
      })

      // Open info window initially for a moment to show the user what it is
      infoWindow.open(window.googleMap, marker);
      
      // Close after 2 seconds to avoid cluttering map
      setTimeout(() => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }
      }, 2000);

      markerRef.current = marker
      circleRef.current = circle
      infoWindowRef.current = infoWindow
    } else {
      // Check if status changed
      if (prevStatusRef.current !== status) {
        setIsBlinking(true)
        
        // Blinking effect when changing states
        let blinkCount = 0
        const blinkInterval = setInterval(() => {
          if (blinkCount >= 6) {
            clearInterval(blinkInterval)
            setIsBlinking(false)
            
            // Update the icon with the new status
            if (markerRef.current) {
              const icon = createTrafficLightIcon(status);
              markerRef.current.setIcon(icon)
            }
            
            // Update the circle color
            if (circleRef.current) {
              circleRef.current.setOptions({
                strokeColor: getStatusColor(status),
                fillColor: getStatusColor(status),
              })
            }
            
            return
          }
          
          if (markerRef.current) {
            // Toggle between normal and blinking state
            const icon = createTrafficLightIcon(status, blinkCount % 2 === 0);
            markerRef.current.setIcon(icon)
            blinkCount++
          }
        }, 200)
      } else {
        // Just update without blinking if not changing state
        if (markerRef.current && !isBlinking) {
          const icon = createTrafficLightIcon(status);
          markerRef.current.setIcon(icon)
        }
        
        // Update the circle color
        if (circleRef.current && !isBlinking) {
          circleRef.current.setOptions({
            strokeColor: getStatusColor(status),
            fillColor: getStatusColor(status),
          })
        }
      }
      
      // Update info window content
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(createInfoWindowContent(id, status))
      }
    }

    // Store current status as previous for the next render
    prevStatusRef.current = status

    // Cleanup on unmount
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }
      if (circleRef.current) {
        circleRef.current.setMap(null)
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
    }
  }, [id, position, status])

  const createInfoWindowContent = (id: string, status: string) => {
    return `
      <div style="padding: 15px; min-width: 220px; border-left: 4px solid ${getStatusColor(status)};">
        <div style="font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 16px;">
          <span>Traffic Light ${id.replace('light-', '')}</span>
          <div style="display: inline-flex; height: 24px; border: 1px solid #aaa; border-radius: 3px; overflow: hidden;">
            <div style="width: 16px; height: 24px; background-color: ${status === "red" ? "#FF0000" : "#551111"}"></div>
            <div style="width: 16px; height: 24px; background-color: ${status === "yellow" ? "#FFAA00" : "#554411"}"></div>
            <div style="width: 16px; height: 24px; background-color: ${status === "green" ? "#00CC00" : "#115511"}"></div>
          </div>
        </div>
        <div style="margin-bottom: 8px; font-size: 14px;">
          <strong>Status:</strong> 
          <span style="color: ${getStatusColor(status)}; font-weight: bold; text-transform: uppercase;">
            ${status}
          </span>
        </div>
        <div style="margin-bottom: 8px; font-size: 14px;">
          <strong>Location:</strong> ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}
        </div>
        <div style="font-style: italic; margin-top: 10px; font-size: 13px; background-color: ${status === "green" ? "#E8F5E9" : status === "yellow" ? "#FFF8E1" : "#FFEBEE"}; padding: 8px; border-radius: 4px;">
          ${status === "green" ? "Emergency vehicle approaching - priority given" : 
            status === "yellow" ? "Preparing for emergency vehicle" : 
            "Normal operation"}
        </div>
      </div>
    `
  }

  return null // This component doesn't render anything directly in the React tree
} 