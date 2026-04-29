import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  bootstrapSession,
  generateAddress,
  fetchInbox,
  fetchMailDetail,
  fetchDomains,
  deleteMail,
  getAddresses,
  KukuAddress,
  GenerateAddressOptions,
} from "../lib/kuku";

export function useKukuInit() {
  const [ready, setReady] = useState(false);
  const [addresses, setAddresses] = useState<KukuAddress[]>([]);

  useEffect(() => {
    bootstrapSession().then(() => {
      setAddresses(getAddresses());
      setReady(true);
    });
  }, []);

  const updateAddresses = () => setAddresses(getAddresses());

  return { ready, addresses, updateAddresses };
}

export function useGenerateAddress(onSuccess?: (address: KukuAddress) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: GenerateAddressOptions = {}) => generateAddress(options),
    onSuccess: (newAddress) => {
      queryClient.invalidateQueries();
      onSuccess?.(newAddress);
    },
  });
}

export function useDomains() {
  return useQuery({
    queryKey: ["kuku", "domains"],
    queryFn: fetchDomains,
    staleTime: 10 * 60 * 1000,
  });
}

export function useInbox(address: string | undefined) {
  return useQuery({
    queryKey: ["kuku", "inbox", address],
    queryFn: () => fetchInbox(address!),
    enabled: !!address,
    refetchInterval: 8000,
  });
}

export function useMailDetail(num: string | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ["kuku", "mail", num, key],
    queryFn: () => fetchMailDetail(num!, key!),
    enabled: !!num && !!key,
  });
}

export function useDeleteMail(address: string | undefined, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (num: string) => deleteMail(num),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kuku", "inbox", address] });
      queryClient.invalidateQueries({ queryKey: ["kuku", "mail"] });
      onSuccess?.();
    },
  });
}
